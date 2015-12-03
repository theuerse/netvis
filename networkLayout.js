 var topologyFilePath = "network/generated_network_top.txt";
 var jsonDirectory = "network/";
 var statusUpdateIntervals = {};
 var images = {
		router: ["res/img/blueRouter.svg","res/img/blueRouterGrey.svg"],
		server: ["res/img/server.svg","res/img/serverGrey.svg"],
		client: ["res/img/client.svg","res/img/clientGrey.svg"]
	 };
 var highlightActive = false;
 	// colors of BYR color wheel, order changed
	var colors = ["#0247fe","#8601af","#66b032","#fe2712","#fefe33","#fb9902",
		      "#0392ce","#3d01a4","#d0ea2b","#a7194b","#66b032","#fabc02"];
 
 $(document).ready(function(){
	    // hide javaScriptAlert - div, proof that js works
	    $(javaScriptAlert).hide();
	    
	    // show loading animation (spinner)
	    $("#graphContainer").append(
			new Spinner({color: '#dcdcdc', scale: 3}).spin().el);
	    
            console.log("ready!"); 
            // get file directly
            $.get(topologyFilePath, function(data) {
                drawTopology(data);
            })
            .fail(function() {
                console.log("Failed to retrieve Topology-File (path correct?)");
            })
            
});  

// draws given topology-data using vis.js (data from e.g. "generated_network_top.txt")
function drawTopology(data){
	var nodes = new vis.DataSet();
	var edges = new vis.DataSet();  
		
	// process file-data
	// seperate lines
	var lines = data.split("\n");
		
	// part = 0 ... # of nodes, 1 .. edges, 2 ... client/server
	var part = -1; 
	var edgeInfo;  // holds information about a single edge
	var nodeInfo;  // holds information about a single node
	var servers = []; // array containing the ids of all servers
	var groups = {}; // contains server -> clients entries
	var numberOfNodes = 0; // total number of nodes
	// bitrateBounds[lower_bound, upper_bound]
	var bitrateBounds = getMinMaxBandwidth(lines);
	
	for(var index in lines){
		if(stringStartsWith(lines[index],"#")) {
			part = part + 1;
			continue;
		}
			
		if(part == 0){
			// lines[index] contains number of nodes (assumed correct everytime)
			numberOfNodes = lines[index];
			for(i = 0; i < numberOfNodes; i++){
			  nodes.add({id: i, group: "router", shadow: true,  color: '#3c87eb',
				  label: 'Pi #' + i, shape: "image", image: images["router"][0],font: "20px arial black"});
			}
		}else if(part == 1){
			// add edges
			// lines[index] contains edge-information
			edgeInfo = lines[index].split(",");

			// add edge first two entries ... connected nodes ( a -> b)
			edges.add({id: edgeInfo[0] + '-'+ edgeInfo[1], from: edgeInfo[0], 
				to: edgeInfo[1], width: ((((edgeInfo[2], edgeInfo[3]) / 2)/ bitrateBounds[1]) * 10), 
				title: getEdgeInfoHtml(edgeInfo), shadow: true});
		}else if(part == 2){
			// update node type (Client / Server) => visual apperance
			// and relationship type color (client and server have matching colors, for now)
			// lines[index] contains properties (Client, Server)
			// e.g. 4,18   --> 4 is a client of the server 18
			nodeInfo = lines[index].split(",");
			
			// images from GPL licensed "Tango Desktop Project" (tango.freedesktop.org)
			// update groups	 
			if(groups[nodeInfo[1]] === undefined){
				groups[nodeInfo[1]] = [nodeInfo[0]];
			} else {
				$.merge(groups[nodeInfo[1]],[nodeInfo[0]]);
			}

			// nodeInfo[1] ... id of server - node
			if($.inArray(nodeInfo[1],servers)<0){
				servers.push(nodeInfo[1]); // add server-id only if not already present					
			}				
			nodes.update({id: nodeInfo[1], label: 'Pi #' + nodeInfo[1], group: "server",
				 shadow: true, shape: "image", image: images["server"][0], font: "20px arial " + colors[$.inArray(nodeInfo[1],servers)]});
			
			// nodeInfo[0] ... id of client - node	
			nodes.update({id: nodeInfo[0], label: 'Pi #' + nodeInfo[0], group: "client",
				 shadow: true, shape: "image", image: images["client"][0], font: "20px arial " + colors[$.inArray(nodeInfo[1],servers)]});
			
		}
	}
	
	// Graph will be drawn in the HTML-Element "graphContainer" [<div></div>]	
	var container = document.getElementById('graphContainer');
	var data = {
		nodes: nodes,
		edges: edges
	};
	
	// allow for defining the seed via GET-param
	var seed = parseInt(getUrlVar("seed"));
	if(isNaN(seed)) seed = 2;

	var options = {
		// specify randomseed => network is the same at every startup
		autoResize: false,
		height: '100%',
		layout:{randomSeed: seed}, 
		edges: {
			hoverWidth: 0
		},
		interaction: {
			hover: true,
			selectConnectedEdges: false,
			hoverConnectedEdges: false,
			tooltipDelay: 300
			},
		physics: {
			stabilization: {
				enabled: true
			} ,
			adaptiveTimestep: true,
			barnesHut: {
				avoidOverlap: 1, // maximum overlap avoidance
				gravitationalConstant: -4000 // neg. value -> repulsion
			}
		}
	}; 
	
	// draw graph
	var network = new vis.Network(container, data, options);
	drawLegend(network,jQuery.extend({},options),numberOfNodes,groups,bitrateBounds); 
    
    // shut down physics when networkLayout has initially stabilized
    network.once("stabilized", function(params) {
		console.log("network stabilized!");
		options.physics ={enabled: false};
		network.setOptions(options);
	});
    
    // show cooltip when mouse enters/hovers node
     network.on("hoverNode", function (params) {
        showNodeCooltip(params.node, network);
    });
    
    // hide cooltip when mouse leaves node
    network.on("blurNode", function (params) {
        hideNodeCooltip(params.node);
    });
    
    network.on("click", function (params){
		highlightSelectedNodes(network);
	});
	
	 $(window).resize(function(){
			var options = {offset: {x:0,y:0},
				duration: 1000,
				easingFunction: "easeInOutQuad"
		};
		network.redraw();
		network.fit({animation:options});
		});
}

// Runs through edge-entries one time, determining the 
// minimal / maximal Bandwith
function getMinMaxBandwidth(lines){
	var part = -1;
	var bitrateBounds = [Number.MAX_VALUE, Number.MIN_VALUE];
	for(var index in lines){
		if(stringStartsWith(lines[index],"#")) {
			part = part + 1;
			continue;
		}
			
		if(part == 1){
			// lines[index] contains edge-information
			edgeInfo = lines[index].split(",");
			// update bitrateBounds statistic
			bitrateBounds = [Math.min(bitrateBounds[0],edgeInfo[2]),Math.max(bitrateBounds[1],edgeInfo[2])];
			bitrateBounds = [Math.min(bitrateBounds[0],edgeInfo[3]),Math.max(bitrateBounds[1],edgeInfo[3])];
		}
		else if(part == 2) break;
	}
	return bitrateBounds;
}

function highlightSelectedNodes(network){
	var nodes = network.body.data.nodes;
	var allNodes = nodes.get({returnType:"Object"});
	var selectedNodeIds = network.getSelectedNodes();
	
	if (highlightActive === true) {
		// reset all nodes / restore 'normal' view 
		for (var nodeId in allNodes) {		
			// affect edge-color inderectly by setting node-color
			allNodes[nodeId].color = '#3c87eb';
        
			// show label
			if (allNodes[nodeId].hiddenLabel !== undefined) {
				allNodes[nodeId].label = allNodes[nodeId].hiddenLabel;
				allNodes[nodeId].hiddenLabel = undefined;
			}
        
			// swap in normal (colored) images
			allNodes[nodeId].image = images[allNodes[nodeId].group][0];
		}
		highlightActive = false
	}
	 
	
	// if something is selected -> highlight it
    if (selectedNodeIds.length > 0) {
		highlightActive = true;

		// mark all non-selected nodes as hard to read.
		for (var nodeId in allNodes) {
			// affect edge-color inderectly by setting node-color
			// to affect every edge, every node-color must be changed
			allNodes[nodeId].color = 'rgba(200,200,200,0.5)';
        
			// do not grey out selected Nodes
			if($.inArray(nodeId,selectedNodeIds)>=0) continue;			
        
			// hide label
			if (allNodes[nodeId].hiddenLabel === undefined) {
				allNodes[nodeId].hiddenLabel = allNodes[nodeId].label;
				allNodes[nodeId].label = undefined;
			}
        
			// swap in greyed-out images
			allNodes[nodeId].image = images[allNodes[nodeId].group][1];
		}
    }  


    // transform the object into an array
    // and write it back
    var updateArray = [];
    for (nodeId in allNodes) {
		if (allNodes.hasOwnProperty(nodeId)) {
			updateArray.push(allNodes[nodeId]);
		}
    }
    nodes.update(updateArray);
}


function drawLegend(network,options,numberOfNodes,groups,bitrateBounds){
	  $('#legendContainer').append('<ul id="legendList" class="list-group">' +
										'<li id="legendGraph" class="noPadding list-group-item"></li>' +
									'</ul>');
	  
	  var nodes = new vis.DataSet();
	  var edges = new vis.DataSet();
	    
      var container = document.getElementById('legendGraph');
      // coordinates originating in midpoint
      var x = container.clientWidth / 2;  
      var y = container.clientHeight / 2; 
      var step = 100;
  
      options.height = '300px'; // limit height, make room for additional information
      options.interaction = {zoomView: false, selectable: false};
      options.physics = {enabled: false};
      
      var serverCount = Object.keys(groups).length;
      var clientCount = 0;
      for(var key in groups){
		 clientCount += groups[key].length;
	  }
      
      nodes.add({id: 1, x: x, y: y, label: 'Router' + ' (' + (numberOfNodes - (serverCount + clientCount)) + ')',
			shape: "image", image: images["router"][0], fixed: true, shadow: true, physics:false});
      nodes.add({id: 2, x: x, y: y + step, label: 'Router + Server' + ' (' + serverCount + ')', 
				shape: "image", image: images["server"][0], fixed: true, shadow: true, physics:false});
      nodes.add({id: 3, x: x, y: y + 2 * step, label: 'Router + Client' + ' (' + clientCount + ')',
		    shape: "image", image: images["client"][0], fixed: true, shadow: true,  physics:false});
      
      var data = {nodes: nodes,edges: edges};
      // draw legend
	  var legend = new vis.Network(container, data, options);
	  
	  // add additional information
	  // min-/ max-Bitrate
	  $('#legendList').append('<li class="list-group-item"><b>min bitrate: </b>' + bitrateBounds[0] + '[kbits]</li>');
	  $('#legendList').append('<li class="list-group-item"><b>max bitrate: </b>' + bitrateBounds[1] + '[kbits]</li>');
	   
	  // add group information
	  var groupsInfo = "";
	  
	  // for every server (group-leader)
	  var i = 0;
	  var keys = Object.keys(groups).reverse();
	  keys.forEach(function(entry) {
			groupsInfo += '<h3 id="grpHeader' + entry +'" style="color: ' + colors[i] +'">Group ' + (++i) + '</h3>' +
					'<div>' +
						'<p>' + entry + ',' + groups[entry] + '</p>' +
					'</div>';
	  });
	  
	  $("#legendList").append('<li class="noPadding list-group-item"><div id="grpAccordion">' + groupsInfo + '</div></li>');
	  $("#grpAccordion").accordion();
	  
	   keys.forEach(function(entry) {
			 $('#grpHeader' + entry).bind('click', function (e) {
				network.selectNodes($.merge([entry],groups[entry]));
				// highlight selected group-nodes
				highlightSelectedNodes(network);
			});
	  });
	  
	  // add random-seed btn
	  $('#legendList').append('<li class="list-group-item"><a href="' + window.location.pathname +'?seed=' + 
			Math.floor((Math.random() * 1000) + 1) +'" class="btn btn-default">random seed</a></li>');
}
    
// checks if a given string starts with given prefix
function stringStartsWith(string, prefix) {
	return string.slice(0,prefix.length) == prefix;
} 


// show tooltip for node
function showNodeCooltip(id,network){
	if($("#" + id).length > 0) return; // only one per id at any time
	
	// calculate screen position	
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is 120px wide)
	pos.x += 150;
	
	var nodeName = network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "");
	var nodeColor = network.body.nodes[id].options.font.color;
	$("body").append('<div id="' + id + '" title="'+ nodeName + '"></div>');
	$('#' + id).dialog({
		beforeClose: function(event, ui){
			widget = $(this).dialog("widget");
			if($("#pin"+id +'.active').length == 0){
				$("button.ui-dialog-titlebar-close", widget).css("border", "2px solid green");
			}else {
				$("button.ui-dialog-titlebar-close", widget).css("border", "1px solid #999");
			}
			return false;
		},
		create: function(event, ui) { 
			widget = $(this).dialog("widget");
			widget.mouseleave(function(){hideNodeCooltip(id);});
			$("button:first",widget).attr('id','pin'+id);
			$(".ui-dialog-titlebar-close span:first", widget)
				.removeClass("ui-icon-closethick")
				.addClass("ui-icon-pin-s"); // use pin-icon
			$(".ui-dialog-titlebar-close span:last", widget).remove(); //remove unused span
			$("button.ui-dialog-titlebar-close", widget).attr("title", "(un-)/pin");
			$(".ui-dialog-titlebar",widget).css("color",nodeColor);
		},
		show: {
			effect: 'fade',
			duration: 500
		},
		resize: function(event, ui) { $(this).css("width","100%");},
		position: { my: "left top", at: "left+" + pos.x +" top+"+pos.y, of: window }
	});
	// set default-height for Cooltip
	$("#"+id).css("height","130px");
	
	// update node-status the first time
	getNodeStatus(id);
	
	// update status in one second intervals (using local cache)
	statusUpdateIntervals[id] = setInterval(function(){getNodeStatus(id)}, 1000);
	
	// 'pin'-btn 'pressed' -> active -> coolTip stays
	// 'pin'-btn 'released' -> not active -> coolTip disappears on 
	// mouseleave
	$("#pin" + id).click(function(){
		$(this).toggleClass("active");
	});
} 

function hideNodeCooltip(id){
	// "h3 button.active" -> select all 'button's which are children of 'h3's
	// and are member of class 'active'
	if($("#pin" + id + '.active').length == 0){
		// shut down status - refresh
		clearInterval(statusUpdateIntervals[id]);
		// Only remove non-pinned cooltips
		$("#" + id).parent().hide(function(){$("#" + id).remove();});
	}
}

// retrieve status-information about node
function getNodeStatus(id){
	// asking for files directly is good for caching
	var jsonFilePath = jsonDirectory + "PI" + id + ".json";
     // get file directly
     $.getJSON(jsonFilePath, function(jsonData) {
			// update content
			$("#" + id).html(buildInfoTable(jsonData));
     });
}

// formats given JSON-data nicely
function buildInfoTable(jsonData){
	var ramUsagePercent = 100 - Math.round((parseInt(jsonData["Free RAM"]) / parseInt(jsonData["Total RAM"]))*100);
	var hddUsagePercent = 100 - Math.round((parseInt(jsonData.Disk.free.replace("G","")) / parseInt(jsonData.Disk.total.replace("G","")))*100);

	var table = '<table class="table">' +
					'<thead></thead>' +
					'<tbody>' +
							'<tr>' +
								'<th>load</th>' +
								'<td>' + jsonData.Load + '</td>' +
							'</tr>' +
							'<tr>' +
								'<th>ram</th>' +
								'<td>' +  
									'<progress value="'+ ramUsagePercent +'" max="100">'+ ramUsagePercent + '%</progress>' +
									ramUsagePercent + '%' +
								'</td>' +
							'</tr>' +
							'<tr>' +
								'<th>net RX</th>' +
								'<td>' + (parseInt(jsonData.rxbytes)/Math.pow(10,9)).toFixed(2) +  ' [GB]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>net TX</th>' +
								'<td>' + (parseInt(jsonData.txbytes)/Math.pow(10,9)).toFixed(2) +  ' [GB]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>voltage</th>' +
								'<td>' + (parseInt(jsonData.voltage)/Math.pow(10,6)).toFixed(3) +  ' [V]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>current</th>' +
								'<td>' + (parseInt(jsonData.current)/Math.pow(10,6)).toFixed(3) +  ' [A]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>CPU temp</th>' +
								'<td>' + jsonData.cputemp.replace("°C","")+ ' [°C]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>PMU temp</th>' +
								'<td>' + jsonData.pmutemp.replace("°C","")+ ' [°C]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>HDD temp</th>' +
								'<td>' + jsonData.hddtemp.replace("°C","")+ ' [°C]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>hdd</th>' +
								'<td>' +
									'<progress value="'+ hddUsagePercent +'" max="100">'+ hddUsagePercent + '%</progress>' +
									hddUsagePercent + '%' +
								'</td>' +
							'</tr>' +
							'<tr>' +
								'<th>cpu 0</th>' +
								'<td>' + parseInt(jsonData.cpu0freq)/1000 +  ' [MHz]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>cpu 1</th>' +
								'<td>' + parseInt(jsonData.cpu1freq)/1000 +  ' [MHz]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>Uptime</th>' +
								'<td>' + jsonData.Uptime.replace("days","")+ ' [days]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>IPv4</th>' +
								'<td>' + jsonData.IPv4 + '</td>' +
							'</tr>' +
					'</tbody>' +
				 '</table>';
	return table;
}

								
// Takes a array containing the edge information and returns a proper 
// html-info-thing, 
// n1,n2,bandwidth in kbits a -> b, bandwidth in kbits a <- b, 
// delay a -> b in ms, delay b -> a in ms
function getEdgeInfoHtml(edgeInfo){
	var arrowRight = '<span class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span>';
	var arrowLeft = '<span class="glyphicon glyphicon-arrow-left" aria-hidden="true"></span>';
	return  '<div class="popover">' +
				'<center><h3 class="popover-title">' +  edgeInfo[0] + arrowLeft + arrowRight + edgeInfo[1] + '</h3></center>' +
				'<div class="popover-content">' +
					'<p>' + 'Bandwidth <b>' + arrowRight +'</b> : ' + edgeInfo[2] + '[kbits]</p>' +
					'<p>' + 'Bandwidth <b>' + arrowLeft +'</b> : ' + edgeInfo[3] + '[kbits]</p>' +
					'<p>' + 'Delay <b>' + arrowRight + '</b> : ' + edgeInfo[4] + '[ms]</p>' +
					'<p>' + 'Delay <b>' + arrowLeft + '</b> : ' + edgeInfo[5] + '[ms]</p>' +
				'</div>' +
			'</div>';
}


// returns the value of a GET-param identified by 'name'
function getUrlVar(name){
	var param = window.location.href.match('/?.*' + name + '=([0-9]*?)(&|$)');
	if(param === null) return undefined;
	else return param[1];
}
 

