 var topologyFilePath = "network/generated_network_top.txt";
 var jsonDirectory = "network/";
					       // cold blue,   red,    yellow, green
 var clientScreenFillColors = ["#1b1b43","#FF0000","#FFFF00","#339900"];
 var clientScreenFontColors = ["#FFFFFF","#FFFFFF","#000000","#FFFFFF"]; 
 var updateInterval = 3000; // normal time between two update-attempts [ms]
 var statusUpdateIntervals = {};
 var logReadIntervals = {};
 var clientLogInfo = {};
 var cooltipDelays = {};
 var edgeToolTips = {};
 var poppedUpEdges = [];
 var images = {
		router: ["res/img/blueRouter.svg","res/img/blueRouterGrey.svg"],
		server: ["res/img/server.svg","res/img/serverGrey.svg"],
		client: ["res/img/client.svg","res/img/clientGrey.svg"]
	 };
 var network;
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
	    
			setupSvgCache();
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
	var clients = []; // array containing the ids of all clients
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
			var edgeId = edgeInfo[0] + '-'+ edgeInfo[1];
			edges.add({id: edgeId, from: edgeInfo[0], 
				to: edgeInfo[1], width: ((((edgeInfo[2], edgeInfo[3]) / 2)/ bitrateBounds[1]) * 10), shadow: true});
			edgeToolTips[edgeId] = getEdgeInfoHtml(edgeInfo);
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
				 shadow: true, shape: "image", image: getClientImageUrl("",clientScreenFillColors[0],clientScreenFontColors[0]), 
				 font: "20px arial " + colors[$.inArray(nodeInfo[1],servers)]});
			if($.inArray(nodeInfo[0],clients)<0){
				clients.push(nodeInfo[0]); // add client-id only if not already present					
			}		
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
			tooltipDelay: 400
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
	network = new vis.Network(container, data, options);
	drawLegend(network,jQuery.extend({},options),numberOfNodes,groups,bitrateBounds); 
    
    // shut down physics when networkLayout has initially stabilized
    network.once("stabilized", function(params) {
		console.log("network stabilized!");
		options.physics ={enabled: false};
		network.setOptions(options);
	});
    
    // show cooltip when mouse enters/hovers node (+ 400[ms] delay)
     network.on("hoverNode", function (params) {
		cooltipDelays[params.node] = setInterval(function(){showNodeCooltip(params.node, network)},400);
    });
    
    // hide cooltip when mouse leaves node
    network.on("blurNode", function (params) {
        hideNodeCooltip(params.node);
        clearInterval(cooltipDelays[params.node]); // cancel cooltip
    });
    
    network.on("hoverEdge", function (params) {
       var edges = network.body.data.edges;
	   var edge = edges.get(params.edge);

	   edge.title = edgeToolTips[params.edge];
	   edges.update([edge]);
	   poppedUpEdges.push(params.edge);
    });
    
     network.on("hidePopup", function (params) {
	   var edges = network.body.data.edges;
	   
	   var changedEdges = [];
	   for(index in poppedUpEdges){
		   var edge = edges.get(poppedUpEdges[index]);
		   edge.title = null;
		   changedEdges.push(edge);
	   }
	   edges.update(changedEdges);
	   poppedUpEdges = [];
    });
    
    network.on("click", function (params){
		if(params.nodes.length == 0){
			highlightSelectedNodes(network); // perform group de-selection
			$("#grpAccordion").accordion("option","active",false); // update legend
		} else if(params.nodes.length == 1){
			showNodeCooltip(params.nodes[0], network);
			toggleCooltipPinned(params.nodes[0]);
		}
	});
	
	 $(window).resize(function(){
			var options = {offset: {x:0,y:0},
				duration: 1000,
				easingFunction: "easeInOutQuad"
		};
		network.redraw();
		network.fit({animation:options});
		});
	
	
	if(getUrlVar("rtlog") === "1"){
		// start reading RealtimeLogs
		clients.forEach(function(client) {
			logReadIntervals[client] = setInterval(function(){updateClientState(client)}, updateInterval);
		});
	
		// periodicalle update svg-layer-statistic chart
		setInterval(function(){updateSVCLayerChart()}, updateInterval);
	}
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

function highlightSelectedNodes(){
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
			if(allNodes[nodeId].group == "client") continue; // make exception for clients
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
			if(allNodes[nodeId].group == "client") continue; // make exception for clients
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


function updateClientState(id){
	
	// get  directly
    $.get(jsonDirectory + "consumer-PI_" + id + ".log" , function(data) {
		
		// seperate lines
		var lines = data.split("\n");
		
		// access last line
		var lastLine = lines[lines.length-2]; // compensate file ending in \n
		//console.log("PI_" + id + ": " + lastLine);
		
		// access individual columns
		var columns = lastLine.split("\t");
		var clientInfo = {date: columns[0], layer: parseInt(columns[4])};
		
		if((clientLogInfo[id] === undefined || Date.parse(clientLogInfo[id].date) < Date.parse(clientInfo.date)) & !isNaN(columns[4])){
			console.log("updating logInfo for PI_"+id);
			clientLogInfo[id] = clientInfo;
			// update graphical representation of client
			updateClientRepresentation(id,clientInfo.layer,clientInfo.layer);
			
		}else {
			// console.log("reading old data, no updating here!");
			// wait a bit for the logfile to be written (completely) ?
		}
       
    })
    .fail(function() {
        console.log("failed retrieving logfile for PI_" + id);
        updateClientRepresentation(id,"",-1); // display default cold blue screen
    })
}

// update the look of the given client according to the given layer
function updateClientRepresentation(id,text,layer){
	var nodes = network.body.data.nodes;
	var allNodes = nodes.get({returnType:"Object"});
	
	var node = allNodes[id]; console.log(node);
	node.image = getClientImageUrl(text,clientScreenFillColors[layer+1],clientScreenFontColors[layer+1]);
	nodes.update([node]);
}

function updateSVCLayerChart(){
	var lvlStatistic = [0,0,0]; // TODO: allow number of layers != 3
	for (var key in clientLogInfo) {
		lvlStatistic[clientLogInfo[key].layer] += 1;
	}
	
	var data = {
    labels: [
        "L2",
        "L1",
        "L0"
    ],
    datasets: [
        {
            data: lvlStatistic,
            backgroundColor: [
				clientScreenFillColors[3],
				clientScreenFillColors[2],
				clientScreenFillColors[1]
            ],
            hoverBackgroundColor: [  
                "#267300",
                "#D9D900",
                "#D90000"
            ]
        }]
	};
	
	var ctx = document.getElementById("chart-area");
	var myPieChart = new Chart(ctx,{
		type:'pie',
		data: data
	});
	
	myPieChart.resize();

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
		    var members = $.merge([entry],groups[entry]).sort(function(a,b){return a - b}); // sort as numbers
			groupsInfo += '<h3 id="grpHeader' + entry +'" style="color: ' + colors[i] +'">Group ' + (++i) + '</h3>' +
					'<div>' +
						'<p>' + members + '</p>' +
					'</div>';
	  });
	  
	  $("#legendList").append('<li class="noPadding list-group-item"><div id="grpAccordion">' + groupsInfo + '</div></li>');
	  $("#grpAccordion").accordion({active: false, collapsible: true});
	  
	   keys.forEach(function(entry) {
			 $('#grpHeader' + entry).bind('click', function (e) {
				network.selectNodes($.merge([entry],groups[entry]));
				// highlight selected group-nodes
				highlightSelectedNodes(network);
			});
	  });
	  
	  // add random-seed btn
	  var rtlog = getUrlVar("rtlog");
	  $('#legendList').append('<li class="list-group-item"><a href="' + window.location.pathname +'?seed=' + 
			Math.floor((Math.random() * 1000) + 1) + ((rtlog) ? '&rtlog=' + rtlog : '')  + '" class="btn btn-default">random seed</a></li>');
			
	 // add realtime-logging - selector
	 var seed = getUrlVar("seed");
	 if(rtlog === "1"){
			$('#legendList').append('<li class="list-group-item"><a href="' + window.location.pathname + ((seed) ? '?seed=' + seed : '') 
				+ '" class="btn btn-danger">ignore rt-logs</a></li>');
			
			// add svc-layer chart
			$('#legendList').append('<li class="list-group-item"><div id="canvas-holder" style="width:100%">' +
				'<canvas id="chart-area" width="150" height="300"></canvas>' +
			'</div></li>');
	 }
	 else{
		  $('#legendList').append('<li class="list-group-item"><a href="' + window.location.pathname +  '?rtlog=1' + ((seed) ? '&seed=' + seed : '') 
				+ '" class="btn btn-success">read rt-logs</a></li>');
	 }
}
    
// checks if a given string starts with given prefix
function stringStartsWith(string, prefix) {
	return string.slice(0,prefix.length) == prefix;
} 


// show tooltip for node
function showNodeCooltip(id){
	if($("#" + id).length > 0) return; // only one per id at any time
	
	// calculate screen position	
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is 150px wide)
	pos.x += 150;
	
	var nodeName = network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "");
	var nodeColor = network.body.nodes[id].options.font.color;
	$("body").append('<div id="' + id + '" title="'+ nodeName + '"></div>');
	$('#' + id).dialog({
		beforeClose: function(event, ui){
			toggleCooltipPinned(id);
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
	
	// update status in three second intervals (using local cache)
	statusUpdateIntervals[id] = setInterval(function(){getNodeStatus(id)}, updateInterval);
} 

// 'pin'-btn is 'pressed' -> active -> coolTip stays
// 'pin'-btn is 'released' -> not active -> coolTip disappears on 
// mouseleave
function toggleCooltipPinned(id){
	var btn = $('#pin' + id + '.ui-button.ui-widget.ui-state-default.ui-corner-all.ui-button-icon-only.ui-dialog-titlebar-close');
	if($("#pin"+id +'.active').length == 0){
		btn.css("border", "2px solid green");
   }
	else{
	   btn.css("border", "1px solid #999");
   }
   $("#pin"+id).toggleClass('active');
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
	var rawJsonString;
	var jsonFilePath = jsonDirectory + "PI" + id + ".json";
     // get file directly
     $.ajax({
		url: jsonFilePath,
		data: rawJsonString,
		dataType: 'text',
		success: function(rawJsonString) {
			var jsonData = parseJSON(rawJsonString);
			if(jsonData == null) return;
			// update content
			$("#" + id).html(buildInfoTable(jsonData));
			$("#pin" + id).parent().children("span").html(
				network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "") + 
					"&emsp;(" + jsonData.date.split(" ")[3] + ")");
		}
	});
}


function parseJSON(jsonString){
	// space for additional cleanup of JSON-String
	
	try {
		var json = $.parseJSON(jsonString);
		return json;
	}
	catch(err) {
		console.log("parsing of JSON - file failed: " + err.message);
		console.log(jsonString);
		return null;
	}
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
									'<meter max="100" value="'+ ramUsagePercent +'">'+ ramUsagePercent + '%</meter>' +
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
									'<meter max="100" value="'+ hddUsagePercent +'">'+ hddUsagePercent + '%</meter>' +
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
	if(param === null) return "";
	else return param[1];
}
 

