 var topologyFilePath = "network/generated_network_top.txt";
 var jsonDirectory = "network/";

 var layers = { //id
                none: {symbol: "", screenFillColor: "#1b1b43", screenFontColor: "#FFFFFF",
                  hoverBackgroundColor: "#1b1b43"}, // cold blue and white font
                0: {symbol: "0", screenFillColor: "#FF0000", screenFontColor: "#FFFFFF",
                  hoverBackgroundColor: "#D90000"}, // red and white font
                1: {symbol: "1", screenFillColor: "#FFFF00", screenFontColor: "#000000",
                  hoverBackgroundColor:  "#D9D900"}, // yellow and black font
                2: {symbol: "2", screenFillColor: "#339900", screenFontColor: "#FFFFFF",
                  hoverBackgroundColor: "#267300"} // green and white font
              };

 var updateInterval = 3000; // normal time between two update-attempts [ms]
 var NodeUpdateIntervals = {};
 var edgeUpdateInterval;
 var svcVisualsUpdateInterval;
 var rtLogNodeUpdateIntervals = {};
 var initialTrafficInfoReceived = false;
 var initialRtLogReceived = false;
 var getFilesInterval;
 var lastConsumedSegmentInfo = {};
 var requestedJsonFiles = [];
 var requestedRtLogFiles = [];
 var clientJson = {};
 var clientRtLogs = {};
 var clientCharts = [];
 var edgeTraffic = {};
 var nodeCoolTipTimeout = {};
 var edgeCoolTipTimeout = {};
 var edgeInformation = {};
 var mode = {traffic: false, rtlog: false}; // delineates the current mode of operation
 var mousePosition = {x: 0, y: 0};
 var nodes;
 var edges;
 var clients = []; // array containing the ids of all clients
 var arrowRight = '<span class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span>';
 var arrowLeft = '<span class="glyphicon glyphicon-arrow-left" aria-hidden="true"></span>';
 var images = {
		router: ["res/img/blueRouter.svg","res/img/blueRouterGrey.svg"],
		server: ["res/img/server.svg","res/img/serverGrey.svg"],
		client: ["res/img/client.svg","res/img/clientGrey.svg"]
	 };
 var network;
 var svcLayerChart;
 var highlightActive = false;
 	// colors of BYR color wheel, order changed
	var colors = ["#0247fe","#8601af","#66b032","#fe2712","#fefe33","#fb9902",
		      "#0392ce","#3d01a4","#d0ea2b","#a7194b","#fabc02"];



//
// Main Entry Point of the Program
//
 $(document).ready(function(){
	    // hide javaScriptAlert - div, proof that js works
	    $(javaScriptAlert).hide();

      $("body").mousemove(function(e) {
        mousePosition.x = e.pageX;
        mousePosition.y = e.pageY;
      });


      //add busy - indicators
      var trafficSpinner = new Spinner({color: '#3170a9',top: '-10px',left: '10px',shadow: true, position: 'relative'}).spin();
      $("#trafficBusyIndicator").append(trafficSpinner.el);
      $("#trafficBusyIndicator").hide();

      var rtLogSpinner = new Spinner({color: '#3170a9',top: '-10px',left: '10px',shadow: true, position: 'relative'}).spin();
      $("#rtLogBusyIndicator").append(rtLogSpinner.el);
      $("#rtLogBusyIndicator").hide();


	    // show loading animation (spinner)
	    $("#graphContainer").append(
			new Spinner({color: '#dcdcdc', scale: 3}).spin().el);

			setupSvgCache();

      console.log("ready!");
      // get file directly
      $.get(topologyFilePath, function(data) {
            drawTopology(data);

            // initially, request json-files for all nodes
            for(var i=0; i < nodes.length; i++){
              setJsonFileRequestState(i,true);
            }
            getFiles();
            requestedJsonFiles = [];

            // start getting requested Files periodically
            getFilesInterval = setInterval(function(){getFiles();},updateInterval);
      })
      .fail(function() {
            console.log("Failed to retrieve Topology-File (path correct?)");
      });
});


// transitions the datatructures and behavior of the program
// according to the given parameters
function changeModeOfOperation(traffic, rtlog){
  // update buttons in legend
  //break down the old

  // cleanup traffic-stuff
  $("#trafficBusyIndicator").hide(); // hide trafficBusyIndicator (if present)
  if(edgeUpdateInterval !== undefined) clearInterval(edgeUpdateInterval); // stop continuously updating edges
  updateEdgeTraffic(false); // reset edges

  // remove all nodes from requestedJsonFiles which aren't open in a cooltip
  var nodesOpenInACooltip = [];
  for(var id = 0; id < nodes.length; id++){
    if($("#" + id).length > 0) nodesOpenInACooltip.push(id);
  }
  requestedJsonFiles = nodesOpenInACooltip;

  // cleanup rtLog-stuff
  $("#rtLogBusyIndicator").hide(); // hide rtLogBusyIndicator (if present)

  // stop rtLogfiles from being fetched periodically
  setRtLogFileRequestState(false);

  // clear svc-visuals update interval
  if(svcVisualsUpdateInterval !== undefined) clearInterval(svcVisualsUpdateInterval);

  // clean up rtLogNodeUpdateIntervals
  clients.forEach(function(entry){
    if($("#rtLogview" + entry).length > 0){
      // close svc-history-overview
      $("#rtLogview" + entry).dialog('close');
    }

    // also remove the updateIntervals
    if(rtLogNodeUpdateIntervals[entry] !== undefined){
      clearInterval(rtLogNodeUpdateIntervals[entry]);
    }
  });

  // remove SVC-LayerChart
  $("#svc-chart-item").remove();

  // reset the client-images
  resetClientImages(clients);



//TODO: Do that! (break down the old)
  mode = {traffic: traffic, rtlog: rtlog}; // update mode of operation



    // start the new
  if(traffic){
    // display busy-indicator
    $("#trafficBusyIndicator").show();

    // initial run
    for(id = 0; id < nodes.length; id++){
      // add all Node-ids to the list of jsonfiles periodically requested
      setJsonFileRequestState(id,true);
    }

    updateEdgeTraffic(true); // initial run
    edgeUpdateInterval = setInterval(function(){updateEdgeTraffic(true);},updateInterval);
  }

  if(rtlog){
    // display busy-indicator
    $("#rtLogBusyIndicator").show();

    // SVC-LayerChart to legend
    // add svc-layer chart
		$('#legendList').append('<li id="svc-chart-item" class="list-group-item"><div id="canvas-holder" style="width:100%">' +
      '<canvas id="chart-area" width="150" height="300"></canvas>' +
		'</div></li>');

    // start reading RealtimeLogs
    // add all rtLogFiles to the Files we periodically get
    setRtLogFileRequestState(true);

    // try to update visuals (client-images and chart) a first time
    updateDisplayedSVCData(clients);

    // periodically update client-visuals and chart
    svcVisualsUpdateInterval = setInterval(function(){updateDisplayedSVCData(clients);}, updateInterval);
  }

}


// draws given topology-data using vis.js (data from e.g. "generated_network_top.txt")
function drawTopology(data){
	nodes = new vis.DataSet();
	edges = new vis.DataSet();

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

		if(part === 0){
			// lines[index] contains number of nodes (assumed correct everytime)
			numberOfNodes = lines[index];
			for(i = 0; i < numberOfNodes; i++){
			  nodes.add({id: i, group: "router", shadow: true, color: '#0c58bc',
				  label: 'Pi #' + i, shape: "image", image: images.router[0],font: "20px arial black"});
			}
		}else if(part == 1){
			// add edges
			// lines[index] contains edge-information
			edgeInfo = lines[index].split(",");
      var width =  ((((parseInt(edgeInfo[2]) + parseInt(edgeInfo[3])) / 2)/ bitrateBounds[1]) * 6);
			// add edge first two entries ... connected nodes ( a -> b)
			var edgeId = edgeInfo[0] + '-'+ edgeInfo[1];
			edges.add({id: edgeId, from: edgeInfo[0],
				to: edgeInfo[1], width: width, shadow: true, color: '#0c58bc', font: {align: 'bottom'}});

      edgeInformation[edgeId]={from: edgeInfo[0], to: edgeInfo[1], bandwidthRight: edgeInfo[2],
        bandwidthLeft: edgeInfo[3], delayRight: edgeInfo[4], delayLeft: edgeInfo[5], initialWidth: width,
        traffic: undefined};
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
				 shadow: true, shape: "image", image: images.server[0], font: "20px arial " + colors[$.inArray(nodeInfo[1],servers)]});

			// nodeInfo[0] ... id of client - node
			nodes.update({id: nodeInfo[0], label: 'Pi #' + nodeInfo[0], group: "client",
				 shadow: true, shape: "image", image: getClientImageUrl(layers.none.symbol,layers.none.screenFillColor,layers.none.screenFontColor),
				 font: "20px arial " + colors[$.inArray(nodeInfo[1],servers)]});
			if($.inArray(nodeInfo[0],clients)<0){
				clients.push(nodeInfo[0]); // add client-id only if not already present
			}
		}
	}

	// Graph will be drawn in the HTML-Element "graphContainer" [<div></div>]
	var container = document.getElementById('graphContainer');
	var graphData = {
		nodes: nodes,
		edges: edges
	};

	// allow for defining the seed via GET-param
	var seed = parseInt(getUrlVar("seed"));
	if(isNaN(seed)) seed = 2;

	var options = {
		// specify randomseed => network is the same at every startup
		autoResize: true,
		height: '100%',
		layout:{randomSeed: seed},
		edges: {
      physics: true,
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
			},
		},
    nodes: {
      physics: true
    }
	};

	// draw graph
	network = new vis.Network(container, graphData, options);
	drawLegend(network,jQuery.extend({},options),numberOfNodes,servers,groups,bitrateBounds);

  // shut down node-physics when networkLayout has initially stabilized
  network.once("stabilized", function(params) {
		console.log("network stabilized!");
		options.nodes.physics = false;
		network.setOptions(options);
	});

    //
    // Various Eventhandlers concerning the network and its (Nodes/Edges)
    //

    // show cooltip when mouse enters/hovers node (+ 400[ms] delay)
    network.on("hoverNode", function (params) {
        clearTimeout(edgeCoolTipTimeout);
        clearTimeout(nodeCoolTipTimeout); // there can ony be one ...
		    nodeCoolTipTimeout = setTimeout(function(){showNodeCooltip(params.node);},400);
        // clean up "left over" edgeCoolTips
        cleanupNonPinnedEdgeCooltips();
    });

    // hide cooltip when mouse leaves node
    network.on("blurNode", function (params) {
        hideNodeCooltip(params.node);
        clearTimeout(nodeCoolTipTimeout); // cancel cooltip - "popping up"
    });

    network.on("blurEdge", function(params){
        clearTimeout(edgeCoolTipTimeout);
        hideEdgeCooltip(params.edge);
    });

    network.on("hoverEdge", function (params) {
        clearTimeout(edgeCoolTipTimeout);
        edgeCoolTipTimeout = setTimeout(function(){showEdgeCooltip(params.edge);},400);
    });

    network.on("click", function (params){
    if(params.nodes.length === 0){
			highlightSelectedNodes(network); // perform group de-selection
			$("#grpAccordion").accordion("option","active",false); // update legend
		} else if(params.nodes.length == 1){
			showNodeCooltip(params.nodes[0]);
			toggleCooltipPinned(params.nodes[0]);
		}

    if(params.edges.length == 1){
      showEdgeCooltip(params.edges[0],network);
      toggleCooltipPinned(params.edges[0]);
    }
	});
}

// Draws a legend containing met-information about the networkLayout (/ Topology)
function drawLegend(network,options,numberOfNodes,servers,groups,bitrateBounds){
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
      options.interaction = {zoomView: false, selectable: false, dragView: false};
      options.physics = {enabled: false};

      var serverCount = servers.length;
      var clientCount = 0;
      for(var key in groups){
		 clientCount += groups[key].length;
	  }

      nodes.add({id: 1, x: x, y: y, label: 'Router' + ' (' + (numberOfNodes - (serverCount + clientCount)) + ')',
			shape: "image", image: images.router[0], fixed: true, shadow: true, physics:false});
      nodes.add({id: 2, x: x, y: y + step, label: 'Router + Server' + ' (' + serverCount + ')',
				shape: "image", image: images.server[0], fixed: true, shadow: true, physics:false});
      nodes.add({id: 3, x: x, y: y + 2 * step, label: 'Router + Client' + ' (' + clientCount + ')',
		    shape: "image", image: images.client[0], fixed: true, shadow: true,  physics:false});

      var data = {nodes: nodes,edges: edges};
      // draw legend
	  var legend = new vis.Network(container, data, options);

	  // add additional information
	  // min-/ max-Bitrate
    // TODO: display of min-/max bitrate of disabled for now
    /*
    $('#legendList').append('<li class="list-group-item"><b>min bitrate: </b>' + bitrateBounds[0] + '[kbps]</li>');
	  $('#legendList').append('<li class="list-group-item"><b>max bitrate: </b>' + bitrateBounds[1] + '[kbps]</li>');
    */

	  // add group information
	  var groupsInfo = "";

	  // for every server (group-leader)
	  servers.forEach(function(entry) {
		    var members = $.merge([entry],groups[entry]).sort(function(a,b){return a - b;}); // sort as numbers
			groupsInfo += '<h3 id="grpHeader' + entry +'" style="color: ' + colors[$.inArray(entry,servers)] +'">Group ' + ($.inArray(entry,servers)+1) + '</h3>' +
					'<div>' +
						'<p>' + members + '</p>' +
					'</div>';
	  });

	  $("#legendList").append('<li class="noPadding list-group-item"><div id="grpAccordion">' + groupsInfo + '</div></li>');
	  $("#grpAccordion").accordion({active: false, collapsible: true});

	   servers.forEach(function(entry) {
			 $('#grpHeader' + entry).bind('click', function (e) {
        if($('#grpHeader' + entry).attr("aria-expanded") === "true"){
          	network.selectNodes($.merge([entry],groups[entry]));
        }else {
            network.selectNodes([]);
        }

				// highlight selected group-nodes
				highlightSelectedNodes(network);
			});
	  });


	  // get params
	   var seed = getUrlVar("seed");

	  // add buttons for toggling traffic / rtLog - watching on or off
	  $('#legendList').append('<li class="list-group-item"><div id="btnGrp">'+
        '<label for="trafficToggle">watch traffic</label><input type="checkbox" id="trafficToggle"/>' +
        '<label for="rtLogToggle">read rtLogs</label><input type="checkbox" id="rtLogToggle" />' +
    '</div></li>');

    $('#btnGrp').buttonset();

    $('#trafficToggle').bind('change', function(){
      if($(this).is(':checked')){
          $(this).button('option', 'label', "ignore traffic");
          changeModeOfOperation(true,mode.rtlog);
        }else{
          $(this).button('option', 'label', "watch traffic");
          changeModeOfOperation(false,mode.rtlog);
        }
      });

      // add toggle-button for traffic      $("#rtLogToggle").button();
      $('#rtLogToggle').bind('change', function(){
        if($(this).is(':checked')){
            $(this).button('option', 'label', "ignore rtLogs");
            changeModeOfOperation(mode.traffic,true);
          }else{
            $(this).button('option', 'label', "read rtLogs");
            changeModeOfOperation(mode.traffic,false);
          }
        });
}

// hightlights all currently selected nodes
// mostly called by the legend in order
// to visualize the members of a group
function highlightSelectedNodes(){
	var allNodes = network.body.data.nodes.get({returnType:"Object"});
  var allEdges = network.body.data.edges.get({returnType:"Object"});
	var selectedNodeIds = network.getSelectedNodes();
  var nodeId;
  var edgeId;

	if (highlightActive === true) {
    // reset all edges
    for(edgeId in allEdges){
      allEdges[edgeId].color = '#0c58bc'; // set edgeColor to a blue tone
    }

		// reset all nodes / restore 'normal' view
		for (nodeId in allNodes) {
			// show label
			if (allNodes[nodeId].hiddenLabel !== undefined) {
				allNodes[nodeId].label = allNodes[nodeId].hiddenLabel;
				allNodes[nodeId].hiddenLabel = undefined;
			}

      // hide border
      allNodes[nodeId].shapeProperties = {useBorderWithImage:false};

			// swap in normal (colored) images
			if(allNodes[nodeId].group == "client") continue; // make exception for clients
			allNodes[nodeId].image = images[allNodes[nodeId].group][0];
		}
		highlightActive = false;
	}


	// if something is selected -> highlight it
    if (selectedNodeIds.length > 0) {
		highlightActive = true;

    // grey out edges, we are now focusing on the nodes!
    for(edgeId in allEdges){
      allEdges[edgeId].color = 'rgba(200,200,200,0.5)'; // set edgeColor to a faint grey color
    }

		// mark all non-selected nodes as hard to read.
		for (nodeId in allNodes) {

			// do not affect ('grey-out') selected Nodes
			if($.inArray(nodeId,selectedNodeIds)>=0){
        // draw border around the selected node
        allNodes[nodeId].shapeProperties = {useBorderWithImage:true};

        // assign the label-color to the border
        allNodes[nodeId].color=allNodes[nodeId].font.split(" ")[2];
        continue;
      }

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


    // update nodes
    var updateArray = [];
    for (nodeId in allNodes) {
		  if (allNodes.hasOwnProperty(nodeId)) {
			  updateArray.push(allNodes[nodeId]);
		  }
    }
    network.body.data.nodes.update(updateArray);

    // update edges
    updateArray = [];
    for(edgeId in allEdges){
      if(allEdges.hasOwnProperty(edgeId)){
        updateArray.push(allEdges[edgeId]);
      }
    }
    network.body.data.edges.update(updateArray);
}

//
// Methods for calculating / displaying the current traffic on the network (using RtLogs)
//

// updates the visual appearance of all edges (according to collected traffic-data)
function updateEdgeTraffic(displayTraffic){

  if(initialTrafficInfoReceived){
      $("#trafficBusyIndicator").hide();
  }

	var edges = network.body.data.edges;
	var allEdges = edges.get({returnType:"Object"});

	var trafficPerEdge = {};
	var maxTraffic = 0;
  var edgeId;
  var edge;

	// get traffic per edge and find max traffic on any edge
	for(edgeId in allEdges) {
		edge = allEdges[edgeId];

    trafficPerEdge[edge.id] = (edgeTraffic[edge.from + "-" + edge.to] === undefined) ? 0 : edgeTraffic[edge.from + "-" + edge.to];
		if(trafficPerEdge[edge.id] > maxTraffic) maxTraffic = trafficPerEdge[edge.id];
	}

	// update edge width ( trafficPerEdge / maxTraffic)
	for(edgeId in allEdges) {
    if(displayTraffic){
      allEdges[edgeId].width = (trafficPerEdge[edgeId] / maxTraffic) * 10;
      // TODO: Text moving has negative impact at cpu when moving nodes -> edgePhysics
      edgeInformation[edgeId].traffic = Math.round(((8* trafficPerEdge[edgeId]) / 1000)); // kbps
      allEdges[edgeId].label = edgeInformation[edgeId].traffic + " [kbps]";

      // update the matching (open) edge-cooltip displaying the edges traffic
      $("#trafficIndicator" + edgeId).html('Traffic: ' + edgeInformation[edgeId].traffic + '[kbps]');
    }else {
      allEdges[edgeId].width = edgeInformation[edgeId].initialWidth;
      allEdges[edgeId].label = "";
    }

	}

    // transform the object into an array and write it back
    var updateArray = [];
    for (edgeId in allEdges) {
		if (allEdges.hasOwnProperty(edgeId)) {
			updateArray.push(allEdges[edgeId]);
		}
    }
    edges.update(updateArray);
}

// bulk-update client-images according to received RtLogs
function updateClientImages(clients){
	var updatedNodes = [];
	var nodes = network.body.data.nodes;
	var allNodes = nodes.get({returnType:"Object"});

	var node;
	var layer;
	clients.forEach(function(clientId) {
    layer = layers[lastConsumedSegmentInfo[clientId].layer];
    if(layer === undefined) layer = layers.none;

		node = allNodes[clientId];
    node.image = getClientImageUrl(layer.symbol, layer.screenFillColor, layer.screenFontColor);
		updatedNodes.push(node);
	});

	nodes.update(updatedNodes);
}

// reverts the clients to their default appearance
function resetClientImages(clients){
  var updatedNodes = [];
  var nodes = network.body.data.nodes;
  var allNodes = nodes.get({returnType:"Object"});

  var node;
  clients.forEach(function(clientId) {
    node = allNodes[clientId];
    node.image = getClientImageUrl(layers.none.symbol, layers.none.screenFillColor, layers.none.screenFontColor);
    updatedNodes.push(node);
  });

  nodes.update(updatedNodes);
}

// Updates all clientImages and the svc-donut-chart
function updateDisplayedSVCData(clients){
      if(initialRtLogReceived){
          $("#rtLogBusyIndicator").hide();

          // update individual client - images
          updateClientImages(clients);

          // update statistics chart
          updateSVCLayerChart();
      }
}

// updates the donut-chart displaying the current count
// of different SVC Representation-Ids 'consumed' by the clients
function updateSVCLayerChart(){
	var lvlStatistic = [0,0,0]; // TODO: allow number of layers != 3
	for (var key in lastConsumedSegmentInfo) {
		lvlStatistic[lastConsumedSegmentInfo[key].layer] += 1;
	}
	var sum = lvlStatistic.reduce(function(pv, cv) { return pv + cv; }, 0);
  var labels = [];
  var backgroundColor = [];
  var hoverBackgroundColor = [];
  var count;
  var percent;

  Object.keys(layers).forEach(function(key,index) {
    if(!isNaN(key)){
      count = (lvlStatistic[key] === undefined) ? 0 : lvlStatistic[key];
      percent = Math.round((count / sum) * 100);
      labels.push("L" + layers[key].symbol + " (" + ((percent < 10) ? "  " + percent : percent) + "%)");
      backgroundColor.push(layers[key].screenFillColor);
      hoverBackgroundColor.push(layers[key].hoverBackgroundColor);
      if(lvlStatistic[key] === undefined){
        lvlStatistic[key] = 0; // all layers must be represented
      }
    }
  });

	var data = {
    labels: labels.reverse(),
    datasets: [
        {
            data: lvlStatistic.reverse(), // necessary, because we start with 0 at the bottom (last element)
            backgroundColor: backgroundColor.reverse(),
            hoverBackgroundColor: hoverBackgroundColor.reverse()
        }]
	};

	var ctx = document.getElementById("chart-area");
  // destroy old chart
  if(svcLayerChart !== undefined) svcLayerChart.destroy();
  // create new/updated version
  svcLayerChart = new Chart(ctx,{
		type:'doughnut',
		data: data
	});

	svcLayerChart.resize();
}



//
// NODE-COOLTIP functions
//

// update the pinned-state / visuals of a node with given id (inside a Cooltip)
// 'pin'-btn is 'pressed' -> active -> coolTip stays
// 'pin'-btn is 'released' -> not active -> coolTip disappears on mouseleave
function toggleCooltipPinned(id){
	var btn = $('#pin' + id + '.ui-button.ui-widget.ui-state-default.ui-corner-all.ui-button-icon-only.ui-dialog-titlebar-close');
	if($("#pin"+id +'.active').length === 0){
		btn.css("border", "2px solid green");
   }
	else{
	   btn.css("border", "1px solid #999");
   }
   $("#pin"+id).toggleClass('active');
}

// create and show Nodecooltip for a given client
function showNodeCooltip(id){
  if(isNaN(id) || ($("#" + id).length !== 0)) return;

  // calculate screen position
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is ...px wide)
	pos.x += $('#legendContainer').width();

	var nodeName = network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "");
	var nodeColor = network.body.nodes[id].options.font.color;

  $("body").append('<div id="' + id + '" title="'+ nodeName + '"></div>');

	$('#' + id).dialog({
    open: function(event, ui){
      // setup periodic updates
      if(NodeUpdateIntervals[id] === undefined){
        // subscribe to periodical updates
        setJsonFileRequestState(id,true);

        // try to update immediately (json file may be already present)
        updateNodeCooltip(id);
        // setup periodic ui - updates
        NodeUpdateIntervals[id] = setInterval(function(){updateNodeCooltip(id);},updateInterval);
      }
    },
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
}

// hides the Node-Cooltip with given id, IF it isn't pinned
function hideNodeCooltip(id){
	// "h3 button.active" -> select all 'button's which are children of 'h3's
	// and are member of class 'active'
	if($("#pin" + id + '.active').length === 0){
    // unsubscribe from updates
    // if not watching traffic, unsubscribe from periodical jsonfileReq.
    if(!mode.traffic){
      setJsonFileRequestState(id,false);
    }
		// shut down status - refresh
		clearInterval(NodeUpdateIntervals[id]);
    delete NodeUpdateIntervals[id];

		// Only remove non-pinned cooltips
		$("#" + id).parent().hide(function(){$("#" + id).remove();});
	}
}

// updates the node-cooltip of a given client(-id)
function updateNodeCooltip(id){
    // use local jsonFile-cache
	// update content
	if(clientJson[id] === undefined) return; // no json retrieved yet
	var jsonData = clientJson[id].current;
	if(jsonData === undefined) return; // still no json retrieved

  if($("#" + id).html() === ""){
      // Cooltip called first time, build html structure of info-table
      $("#" + id).html(buildInfoTable(id));
  }

  // update cooltip - info-table
  updateInfoTable(id,jsonData);

  // update cooltip header (name of pi, time and stuff)
	$("#pin" + id).parent().children("span").html(
		network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "") +
		"&emsp;(" + jsonData.date.split(" ")[3] + ")");

  // add eventHandler to rtLogBtn to allow user to open rtLog-'history'
  if(mode.rtlog){
    $("#rtLogWatchBtn" + id).click(function(){
      showNodeRtLogview(id);
    });
  }
}

// create a info-table structure to be displayed in the Node-cooltip
function buildInfoTable(id){
  // add a button to call the timeline-view (if reading rtlogs and node is a client)
  // TODO: update this in changeModeOfOperation!
  var rtLogWatchBtn = (mode.rtlog && (network.body.data.nodes.get({returnType:"Object"})[id].group === "client")) ?
  '<tr><th>layer</th><td><div id="rtLogWatchBtn' + id +'" class="btn btn-default">watch</div></td></tr>': "";

	var table = '<table class="table">' +
					'<thead></thead>' +
					'<tbody>' +
              '<tr><th>load</th><td id="info_load' + id +'" class="info_load"></td></tr>' +
							'<tr><th>ram</th><td class="info_ram"></td></tr>' +
							'<tr><th>net RX</th><td class="info_netRx"></td></tr>' +
							'<tr><th>net TX</th><td class="info_netTx"></td></tr>' +
							'<tr><th>voltage</th><td class="info_voltage"></td></tr>' +
							'<tr><th>current</th><td class="info_current"></td></tr>' +
							'<tr><th>CPU temp</th><td class="info_cputemp"></td></tr>' +
							'<tr><th>PMU temp</th><td class="info_pmutemp"></td></tr>' +
							'<tr><th>HDD temp</th><td class="info_hddtemp"></td></tr>' +
							'<tr><th>hdd</th><td class="info_hddUsagePercent"></td></tr>' +
							'<tr><th>cpu 0</th><td class="info_cpu0freq"></td></tr>' +
							'<tr><th>cpu 1</th><td class="info_cpu1freq"></td></tr>' +
							'<tr><th>Uptime</th><td class="info_uptime"></td></tr>' +
							'<tr><th>IPv4</th><td class="info_IPv4"></td></tr>' +
              rtLogWatchBtn +
					'</tbody>' +
				 '</table>';
	return table;
}

// update a html-infotable found in a Node-Cooltip
function updateInfoTable(id,jsonData){
	var ramUsagePercent = 100 - Math.round((parseInt(jsonData["Free RAM"]) / parseInt(jsonData["Total RAM"]))*100);
	var hddUsagePercent = 100 - Math.round((parseInt(jsonData.Disk.free.replace("G","")) / parseInt(jsonData.Disk.total.replace("G","")))*100);

  $("#" + id + " td.info_load").html(jsonData.Load);
  $("#" + id + " td.info_ram").html('<meter max="100" value="'+ ramUsagePercent +'">'+ ramUsagePercent + '%</meter>' +
  ramUsagePercent + '%');
  $("#" + id + " td.info_netRx").html((parseInt(jsonData.rxbytes)/Math.pow(10,9)).toFixed(2) + " [GB]");
  $("#" + id + " td.info_netTx").html((parseInt(jsonData.txbytes)/Math.pow(10,9)).toFixed(2) + " [GB]");
  $("#" + id + " td.info_voltage").html((parseInt(jsonData.voltage)/Math.pow(10,6)).toFixed(3) + " [V]");
  $("#" + id + " td.info_current").html((parseInt(jsonData.current)/Math.pow(10,6)).toFixed(3) + " [A]");
  $("#" + id + " td.info_cputemp").html(jsonData.cputemp.replace("°C","") + " [°C]");
  $("#" + id + " td.info_pmutemp").html(jsonData.pmutemp.replace("°C","")+ " [°C]");
  $("#" + id + " td.info_hddtemp").html(jsonData.hddtemp.replace("°C","")+ " [°C]");
  $("#" + id + " td.info_hddUsagePercent").html('<meter max="100" value="'+ hddUsagePercent +'">'+ hddUsagePercent + '%</meter>' +
  hddUsagePercent + '%');
  $("#" + id + " td.info_cpu0freq").html(parseInt(jsonData.cpu0freq)/1000 +  " [MHz]");
  $("#" + id + " td.info_cpu1freq").html(parseInt(jsonData.cpu1freq)/1000 +  " [MHz]");
  $("#" + id + " td.info_uptime").html(jsonData.Uptime);
  $("#" + id + " td.info_IPv4").html(jsonData.IPv4);
}



//
// Edge-Cooltip Methods
//

// create and show Nodecooltip for a given client
function showEdgeCooltip(id){
  if($("#" + id).length !== 0) return;
  var edgeInfo = edgeInformation[id];

	var title = 'Pi #' + edgeInfo.from + '&emsp; &#x21c4 &emsp;' + 'Pi #' + edgeInfo.to;

  var trafficInfo = (mode.traffic) ? ('<p id="trafficIndicator' + id + '">' + 'Traffic: ' + edgeInfo.traffic + '[kbps]</p>') : "";

  $("body").append('<div id="' + id + '" title="'+ title + '">' +
    '<p>' + 'Bandwidth <b>' + arrowRight +'</b> : ' + edgeInfo.bandwidthRight + '[kbps]</p>' +
    '<p>' + 'Bandwidth <b>' + arrowLeft +'</b> : ' + edgeInfo.bandwidthLeft + '[kbps]</p>' +
    '<p>' + 'Delay <b>' + arrowRight + '</b> : ' + edgeInfo.delayRight + '[ms]</p>' +
    '<p>' + 'Delay <b>' + arrowLeft + '</b> : ' + edgeInfo.delayLeft + '[ms]</p>' +
    trafficInfo +
  '</div>');

	$('#' + id).dialog({
		beforeClose: function(event, ui){
			toggleCooltipPinned(id);
			return false;
		},
		create: function(event, ui) {
			widget = $(this).dialog("widget");
			widget.mouseleave(function(){clearTimeout(edgeCoolTipTimeout); hideEdgeCooltip(id);});
			$("button:first",widget).attr('id','pin'+id);
			$(".ui-dialog-titlebar-close span:first", widget)
				.removeClass("ui-icon-closethick")
				.addClass("ui-icon-pin-s"); // use pin-icon
			$(".ui-dialog-titlebar-close span:last", widget).remove(); //remove unused span
			$("button.ui-dialog-titlebar-close", widget).attr("title", "(un-)/pin");
		},
		show: {
			effect: 'fade',
			duration: 500
		},
		resize: function(event, ui) { $(this).css("width","100%");},
		position: { my: "left top", at: "left+" + mousePosition.x +" top+"+mousePosition.y, of: window }
	});
}

// hides the Edge-Cooltip with given id, IF it isn't pinned
function hideEdgeCooltip(id){
	// "h3 button.active" -> select all 'button's which are children of 'h3's
	// and are member of class 'active'
	if($("#pin" + id + '.active').length === 0){
		// Only remove non-pinned cooltips
		$("#" + id).parent().hide(function(){$("#" + id).remove();});
	}
}

function cleanupNonPinnedEdgeCooltips(){
  var edges = network.body.data.edges;
  var allEdges = edges.get({returnType:"Object"});

  for(var edgeId in allEdges) {
    hideEdgeCooltip(edgeId);
  }
}

//
// methods for displaying and updating a TimeLine-overview of
// the last consumed SVC RepresentationId
//

// creates and shows a Timeline-Chart displaying the consumed SVC RepresentationIds
// of a given client(-id)
function showNodeRtLogview(id){
  var firstTime = ($("#rtLogview" + id).length === 0);
	// calculate screen position
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is ...px wide)
	pos.x += $('#legendContainer').width();

  if(firstTime){
    $("body").append('<div id="rtLogview' + id + '" title="Pi #' + id + '" >' +
          '<div id="chart'+ id +'"></div></div>');
  }

  var nodeColor = network.body.nodes[id].options.font.color;

	$("#rtLogview" + id).dialog({
    open: function(event, ui){
      // update
      updateNodeRtLogView(id);

      // setup periodic updates
      clearInterval(rtLogNodeUpdateIntervals[id]);
      rtLogNodeUpdateIntervals[id] = setInterval(function(){updateNodeRtLogView(id);},updateInterval);
    },
    beforeClose: function(event,ui){
      // stop the periudic ui-updates
      clearInterval(rtLogNodeUpdateIntervals[id]);
    },
    create: function(event, ui) {
			widget = $(this).dialog("widget");
			$(".ui-dialog-titlebar",widget).css("color",nodeColor);
		},
    width: 600,
    height: 220,
    position: { my: "left top", at: "left+" + pos.x +" top+"+pos.y, of: window },
    resize: function(event, ui) { $(this).css("width","100%");},
  });

  if(firstTime){
    clientCharts[id] = c3.generate({
        size: {
          height: 150
        },
        bindto: '#chart' + id,
        data: {
           x: 'x',
            columns: [ // lvl + 1  for display purposes
                ['sample']
            ],
             types: {
                sample: 'area-step',
            },
        },
        transition: {
            duration: 0
        },
        axis : {
            x: {
                label: {
                    text: 'Segment Number',
                    position: 'outer-center'
                },
                tick: {
                    culling: {max: 75}
                }
            },
            y : {
                label: {
                    text: 'Layer',
                    position: 'outer-middle'
                },
                tick: {
                    // change displayed y-value
                    format: function (d) {
                      if(((d-1) < 0) || !Number.isInteger(d)) return "";
                      if(layers[d-1] !== undefined) return layers[d-1].symbol;
                       return (d-1);
                     }
                }
            }
        },
        tooltip: {show: false},
        subchart: {show: false},
        zoom: {enabled: true},
        interaction: {enabled: true},
        legend: {show: false},
    });

    $('#chart' + id).click(function(){
      if(rtLogNodeUpdateIntervals[id] === undefined){
          // periodical chart-updates have been paused previously
          // start updating periodically
          rtLogNodeUpdateIntervals[id] = setInterval(function(){updateNodeRtLogView(id);},updateInterval);
      }else {
          // chart has been periodically updated until now, now pause
          clearInterval(rtLogNodeUpdateIntervals[id]);
          delete (rtLogNodeUpdateIntervals[id]);
      }
    });
  }
}

// update the Timeline-Chart of a given Client(-id) using a given rtLogfile
function updateNodeRtLogView(id){
  if((!$("#rtLogview" + id).is(":visible")) || (clientCharts[id] === undefined)) return;

  // seperate lines
  var newEntries = [];
  var segmentNumbers=[];
  var lines = clientRtLogs[id].split("\n");
  var quality;

  for(var index = Math.max(lines.length-150,0); index < lines.length; index++){
      var columns = lines[index].split("\t");
      if((columns.length < 5)) continue;
      if(!isNaN(columns[2])) segmentNumbers.push(parseInt(columns[2]));
      if(!isNaN(columns[4])){newEntries.push(parseInt(columns[4])+1);}
  }

    clientCharts[id].load({
          columns: [
            ['x'].concat(segmentNumbers),
            ['sample'].concat(newEntries),
          ],
          length: 0,
    });

    // set zoom (zoom to specified domain)
    clientCharts[id].zoom([Math.max(lines.length-20,0), Math.max(lines.length,20)]);
}


//
// Utility Methods
//

function getFiles(){
  requestedJsonFiles.forEach(function(id){
    getJsonFile(id,undefined);
  });
  requestedRtLogFiles.forEach(function(id){
    getRtLogFile(id);
  });
}

// requests a given json-file, than stores it in a local chache (prev and current .json)
function getJsonFile(id, callback){
	var rawJsonString;
     // get file directly
     $.ajax({
		url: getJsonFileName(id),
		data: rawJsonString,
		dataType: 'text',
		success: function(rawJsonString) {
			var jsonData = parseJSON(rawJsonString);
			if(jsonData === null) return;

			// cache locally
			if(clientJson[id] === undefined){
				clientJson[id] = {previous: undefined, current: jsonData};
			}
			else{
				clientJson[id].previous = clientJson[id].current;
				clientJson[id].current = jsonData;

				if(clientJson[id].current.date != clientJson[id].previous.date){ // deal with reading the same file several times
          /* different file! */
          // indicate that at least 2 jsonFiles have arrived
          if(!initialTrafficInfoReceived) initialTrafficInfoReceived = true;

          updateTrafficInfo(id);
				}else {/* same file!" */}
			}

			if(callback !== undefined){
				callback(id);
			}
		}
	});
}

function updateTrafficInfo(clientId){
  // time interval between prev. and current json-file
  elapsedSeconds = (parseDate(clientJson[clientId].current.date) - parseDate(clientJson[clientId].previous.date))/1000;
  var edgeId;
  var prevTraffic;

  // for every mentioned edge in Traffic-Data
  Object.keys(clientJson[clientId].current.Traffic).forEach(function(ip,traffic) {

    edgeId = clientId + "-" + getIdFromIP(ip);
    // node that edge originates in is the source of the traffic-data
    if(edges.get(edgeId) !== null){
      // no previous value, traffic is zero
      prevTraffic = (clientJson[clientId].previous.Traffic[ip] === undefined) ? 0 : parseInt(clientJson[clientId].previous.Traffic[ip]);

      edgeTraffic[edgeId] = parseInt(clientJson[clientId].current.Traffic[ip]) - parseInt(clientJson[clientId].previous.Traffic[ip]);
      edgeTraffic[edgeId] = Math.round(edgeTraffic[edgeId] / elapsedSeconds); // traffic now in bytes per second
    }
  });
}

function getRtLogFile(id){

	// get  directly
    $.get(jsonDirectory + getRtLogFileName(id) , function(data) {

		// seperate lines
		var lines = data.split("\n");

		// access last line
		var lastLine = lines[lines.length-2]; // compensate file ending in \n
		//console.log("PI_" + id + ": " + lastLine);

    if(lastLine === undefined){
      console.log("last line not found in logfile for PI_" + id);
      // display default cold blue screen
      lastConsumedSegmentInfo[id] = {date: new Date(), layer: -1};
      return;
    }

		// access individual columns
		var columns = lastLine.split("\t");
		var clientInfo = {date: columns[0], layer: parseInt(columns[4])};

		// TODO: check dates?
		//if((lastConsumedSegmentInfo[id] === undefined || Date.parse(lastConsumedSegmentInfo[id].date) < Date.parse(clientInfo.date)) & !isNaN(columns[4]))
		lastConsumedSegmentInfo[id] = clientInfo;
    clientRtLogs[id] = data;
    if(!initialRtLogReceived){
      updateNodeRtLogView(id);
      initialRtLogReceived = true; // we received a rtlog-file
    }
    })
    .fail(function() {
        console.log("failed retrieving logfile for PI_" + id);
        // display default cold blue screen
		    lastConsumedSegmentInfo[id] = {date: new Date(), layer: -1};
  });
}

function getJsonFileName(id){
 return  jsonDirectory + "PI" + id + ".json";
}

function getRtLogFileName(id){
  return "consumer-PI_" + id + ".log";
}

// updates global list of json-files to get periodically, imitate set-behaviour
function setJsonFileRequestState(id, fetchPeriodically){
  var index = requestedJsonFiles.indexOf(id);
  if(fetchPeriodically && (index === -1)){
    requestedJsonFiles.push(id);
  }
  if(!fetchPeriodically && (index > -1)){
    requestedJsonFiles.splice(index,1);
  }
}

// updates global list of rtLog-files to get periodically, imitate set-behaviour
// Either get all of them, or
function setRtLogFileRequestState(fetchAllPeriodically){
  requestedRtLogFiles = [];
  if(fetchAllPeriodically){
    requestedRtLogFiles = clients.slice(); // copy whole array
  }
}


// Runs through given edge-entries one time, determining the
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

// checks if a given string starts with given prefix
function stringStartsWith(string, prefix) {
	return string.slice(0,prefix.length) == prefix;
}

// checks if a given string ends with a given suffix
function stringEndsWith(string, suffix){
  return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

// returns the value of a GET-param identified by 'name'
function getUrlVar(name){
	var param = window.location.href.match('/?.*' + name + '=([0-9]*?)(&|$)');
	if(param === null) return "";
	else return param[1];
}

// builds a get-param string out of given argument (object containing key->value pairs)
function getParamString(values){
	var count = 0;
	var paramString= "";
	Object.keys(values).forEach(function(key,index) {
		if(values[key]){
			if(count++ === 0) paramString+= "?";
			else paramString+= "&";
			paramString += key + "=" + values[key];
		}
	});
	return paramString;
}

// converts the date-format occurring in the rtLog-files to a Date
function parseDate(dateString){
  // make Tue Jan 5 11:28:02 CET 2016 to Jan 5 12:07:01 2016 and return date-object
  var parts = dateString.split(" ");
  return Date.parse(parts[1] + " " + parts[2] + " " + parts[3] + " " + parts[5]);
}

// returns the node-id given it's IPv4-address ("192.168.0.23/24" or "192.168.1.28")
function getIdFromIP(ip){
  var simpleIp = ip.split("/")[0];
  return parseInt(simpleIp.split(".")[3]) -10;
}

// takes a JSON string / tries to parse it and returns a json-object if successful
// or prints the error and returns null if parsing failed
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
