 var topologyFilePath = "network/generated_network_top.txt";
 var jsonDirectory = "network/";
 var statusUpdateIntervals = {};
 
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
	// colors of BYR color wheel, order changed
	var colors = ["#0247fe","#8601af","#66b032","#fe2712","#fefe33","#fb9902",
		      "#0392ce","#3d01a4","#d0ea2b","#a7194b","#66b032","#fabc02"];
		
	// process file-data
	// seperate lines
	var lines = data.split("\n");
		
	// part = 0 ... # of nodes, 1 .. edges, 2 ... client/server
	var part = -1; 
	var edgeInfo;  // holds information about a single edge
	var nodeInfo;  // holds information about a single node
	var servers=[]; // array containing the ids of all servers
	
	for(var index in lines){
		if(stringStartsWith(lines[index],"#")) {
			part = part + 1;
			continue;
		}
			
		if(part == 0){
			// lines[index] contains number of nodes (assumed correct everytime)
			for(i = 0; i < lines[index]; i++){
			  nodes.add({id: i, group: "node", shadow: true, 
				  label: 'Pi #' + i});
			}
		}else if(part == 1){
			// add edges
			// lines[index] contains edge-information
			edgeInfo = lines[index].split(",");

			// add edge first two entries ... connected nodes ( a -> b)
			edges.add({id: edgeInfo[0] + '-'+ edgeInfo[1], from: edgeInfo[0], 
				to: edgeInfo[1], title: getEdgeInfoHtml(edgeInfo), shadow: true});
		}else if(part == 2){
			// update node type (Client / Server) => visual apperance
			// and relationship type color (client and server have matching colors, for now)
			// lines[index] contains properties (Client, Server)
			// e.g. 4,18   --> 4 is a client of the server 18
			// console.log(lines[index]);
			nodeInfo = lines[index].split(",");
			
			// images from GPL licensed "Tango Desktop Project" (tango.freedesktop.org)
			// nodeInfo[1] ... id of server - node
			if($.inArray(nodeInfo[1],servers)<0){
				servers.push(nodeInfo[1]); // server-id only, if not already present					
			}				
			nodes.update({id: nodeInfo[1], label: 'Pi #' + nodeInfo[1], group: "server",
				 shadow: true, font: "14px arial " + colors[$.inArray(nodeInfo[1],servers)]});

			// nodeInfo[0] ... id of client - node
			nodes.update({id: nodeInfo[0], label: 'Pi #' + nodeInfo[0], group: "client",
				 shadow: true, font: "14px arial " + colors[$.inArray(nodeInfo[1],servers)]});
				
	
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
		layout:{randomSeed: seed}, 
		groups: { // define common properties of certain groups of nodes
			node: {
				shape: "image", 
				image: "blueRouter.svg",
				physics: true
			},
			server: {
				shape: "image",
				image: "server.svg",
				physics: true
			},
			client: {
				shape: "image",
				image: "client.svg",
				physics: true
			}
		},
		interaction: {
			hover: true,
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
	drawLegend(options); 
    
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
}

function drawLegend(options){
	  // draw legend
	  var nodes = new vis.DataSet();
	  var edges = new vis.DataSet();
	    
      var container = document.getElementById('legendContainer');
      // coordinates originating in midpoint
      var x = container.clientWidth / 2;  
      var y = container.clientHeight / 2; 
      var step = 100;
      
      options.interaction = {zoomView: false, selectable: false};
      options.physics = {enabled: false};
      
      nodes.add({id: 1, x: x, y: y, label: 'Router', group: 'node', fixed: true, shadow: true, physics:false});
      nodes.add({id: 2, x: x, y: y + step, label: 'Router + Server', group: 'server', fixed: true, shadow: true, physics:false});
      nodes.add({id: 3, x: x, y: y + 2 * step, label: 'Router + Client', group: 'client', fixed: true, shadow: true,  physics:false});
      
      var data = {nodes: nodes,edges: edges};
      // draw legend
	  var network = new vis.Network(container, data, options);
}
    
// checks if a given string starts with given prefix
function stringStartsWith(string, prefix) {
	return string.slice(0,prefix.length) == prefix;
} 

//show tooltip for edge ?

// show tooltip for node
function showNodeCooltip(id,network){
	if($("#" + id).length > 0) return; // only one per id at any time
	
	// calculate screen position	
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is 120px wide)
	pos.x += 120;
	
	// add cooltip
	var coolTip = '<div id="' + id + '" style="position: absolute; top:' + pos.y +'px; left:' + pos.x + 'px; z-index: 11;"  class="cooltip popover right">' +
				'<h3 class="popover-title">' +
					'<button id="pin' + id + '" type="button" class="pin-btn btn btn-default btn-xs">' + 
						'<span class="glyphicon glyphicon-pushpin" aria-hidden="true"></span>' +
					'</button>' +
					 '<span>' + network.body.nodes[id].options.label +'</span>' +
				'</h3>' +
			'<div class="popover-content">' +
			'</div>' +
	'</div>';
	
	// update node-status the first time
	getNodeStatus(id);
	
	// update status in one second intervals (using local cache)
	statusUpdateIntervals[id] = setInterval(function(){getNodeStatus(id)}, 1000);
	
	// add cooltip to DOM tree and fade it in
	$(coolTip).hide().appendTo("body").fadeIn();
	
	// 'pin'-btn 'pressed' -> active -> coolTip stays
	// 'pin'-btn 'released' -> not active -> coolTip disappears on 
	// mouseleave
	$("#pin" + id).click(function(){
		$(this).toggleClass("active");
	});
	
	// close coolTip at mouseleave
	$("#" + id).mouseleave(function(){
		// only act, when target is fully visible (fadeIn finished)
		if($("#" + id).css('opacity') < 1) return;
		
		hideNodeCooltip(id);
	});
	
	// make coolTip draggable (thx jqueryUI)
	$("#" + id).draggable();
} 

function hideNodeCooltip(id){
	// "h3 button.active" -> select all 'button's which are children of 'h3's
	// and are member of class 'active'
	if($("#" + id +" h3 button.active").length == 0){
		// shut down status - refresh
		clearInterval(statusUpdateIntervals[id]);
		// Only remove non-pinned cooltips
		$("#" + id).fadeOut( function() { $(this).remove(); });
	}
}

// retrieve status-information about node
function getNodeStatus(id){
	// asking for files directly is good for caching
	var jsonFilePath = jsonDirectory + "PI" + id + ".json";
     // get file directly
     $.getJSON(jsonFilePath, function(jsonData) {
			// update content
			$("#" + id + '> div.popover-content:first').html(buildInfoTable(jsonData));
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
								'<th>cpu 0</th>' +
								'<td>' + parseInt(jsonData.cpu0freq)/1000 +  ' [MHz]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>cpu 1</th>' +
								'<td>' + parseInt(jsonData.cpu1freq)/1000 +  ' [MHz]</td>' +
							'</tr>' +
							'<tr>' +
								'<th>ram</th>' +
								'<td>' +
									'<div class="progress">' +
										 '<div class="progress-bar" role="progressbar" aria-valuenow="'+ ramUsagePercent +
												'" aria-valuemin="0" aria-valuemax="100" style="color: black; text-shadow: 0 0 2px #fff;width:'+ ramUsagePercent +'%">' +
												ramUsagePercent +'%' +
											'</div>' +
									 '</div>' +
								'</td>' +
							'</tr>' +
							'<tr>' +
								'<th>hdd</th>' +
								'<td>' +
									'<div class="progress">' +
										 '<div class="progress-bar" role="progressbar" aria-valuenow="'+ hddUsagePercent +
												'" aria-valuemin="0" aria-valuemax="100" style="color: black; text-shadow: 0 0 2px #fff;width:'+ hddUsagePercent +'%">' +
												hddUsagePercent +'%' +
											'</div>' +
									 '</div>' +
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
 

