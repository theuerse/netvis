 var topologyFilePath = "network/generated_network_top.txt";
 var jsonDirectory = "network/";
					       // cold blue,   red,    yellow, green
 var clientScreenFillColors = ["#1b1b43","#FF0000","#FFFF00","#339900"];
 var clientScreenFontColors = ["#FFFFFF","#FFFFFF","#000000","#FFFFFF"];
 var updateInterval = 3000; // normal time between two update-attempts [ms]
 var NodeUpdateIntervals = {};
 var edgeUpdateInterval;
 var svcVisualsUpdateInterval;
 var rtLogNodeUpdateIntervals = {};
 var initialTrafficInfoReceived = false;
 var initialRtLogReceived = false;
 var logReadIntervals = {};
 var getFilesInterval;
 var lastConsumedSegmentInfo = {};
 var requestedJsonFiles = [];
 var requestedRtLogFiles = [];
 var clientJson = {};
 var clientRtLogs = {};
 var clientCharts = [];
 var clientTraffic = {};
 var cooltipDelays = {};
 var edgeToolTips = {};
 var poppedUpEdges = [];
 var initialEdgeWidths = {};
 var mode = {traffic: false, rtlog: false}; // delineates the current mode of operation
 var nodes;
 var clients = []; // array containing the ids of all clients
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



//
// Main Entry Point of the Program
//
 $(document).ready(function(){
	    // hide javaScriptAlert - div, proof that js works
	    $(javaScriptAlert).hide();

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

		if(part === 0){
			// lines[index] contains number of nodes (assumed correct everytime)
			numberOfNodes = lines[index];
			for(i = 0; i < numberOfNodes; i++){
			  nodes.add({id: i, group: "router", shadow: true,  color: '#3c87eb',
				  label: 'Pi #' + i, shape: "image", image: images.router[0],font: "20px arial black"});
			}
		}else if(part == 1){
			// add edges
			// lines[index] contains edge-information
			edgeInfo = lines[index].split(",");
      var width =  ((((edgeInfo[2], edgeInfo[3]) / 2)/ bitrateBounds[1]) * 10);
			// add edge first two entries ... connected nodes ( a -> b)
			var edgeId = edgeInfo[0] + '-'+ edgeInfo[1];
			edges.add({id: edgeId, from: edgeInfo[0],
				to: edgeInfo[1], width: width, shadow: true, font: {align: 'bottom'}});
			edgeToolTips[edgeId] = getEdgeInfoHtml(edgeInfo);
      initialEdgeWidths[edgeId] = width;
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
				 shadow: true, shape: "image", image: getClientImageUrl("",clientScreenFillColors[0],clientScreenFontColors[0]),
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
	network = new vis.Network(container, graphData, options);
	drawLegend(network,jQuery.extend({},options),numberOfNodes,servers,groups,bitrateBounds);

    // shut down physics when networkLayout has initially stabilized
    network.once("stabilized", function(params) {
		console.log("network stabilized!");
		options.physics ={enabled: false};
		network.setOptions(options);
	});

    //
    // Various Eventhandlers concerning the network and its (Nodes/Edges)
    //

    // show cooltip when mouse enters/hovers node (+ 400[ms] delay)
     network.on("hoverNode", function (params) {
		cooltipDelays[params.node] = setTimeout(function(){showNodeCooltip(params.node, network);},400);
    });

    // hide cooltip when mouse leaves node
    network.on("blurNode", function (params) {
        hideNodeCooltip(params.node);
        clearInterval(cooltipDelays[params.node]); // cancel cooltip - "popping up"
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
		if(params.nodes.length === 0){
			highlightSelectedNodes(network); // perform group de-selection
			$("#grpAccordion").accordion("option","active",false); // update legend
		} else if(params.nodes.length == 1){
			showNodeCooltip(params.nodes[0], network);
			toggleCooltipPinned(params.nodes[0]);
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
      options.interaction = {zoomView: false, selectable: false};
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

	  // add random-seed btn
	  $('#legendList').append('<li class="list-group-item"><a href="' + window.location.pathname +
		getParamString({seed: Math.floor((Math.random() * 1000) + 1)}) +'" class="btn btn-default">random seed</a></li>');

    // add toggle-button for traffic
    $('#legendList').append('<li class="list-group-item">' +
        '<label for="trafficToggle">watch traffic</label>'+
        '<input type="checkbox" id="trafficToggle" />' +
    '</li>');
    $("#trafficToggle").button();
    $('#trafficToggle').bind('change', function(){
      if($(this).is(':checked')){
          $(this).button('option', 'label', "ignore traffic");
          changeModeOfOperation(true,mode.rtlog);
        }else{
          $(this).button('option', 'label', "watch traffic");
          changeModeOfOperation(false,mode.rtlog);
        }
      });

      // add toggle-button for traffic
      $('#legendList').append('<li class="list-group-item">' +
          '<label for="rtLogToggle">read rtLogs</label>'+
          '<input type="checkbox" id="rtLogToggle" />' +
      '</li>');
      $("#rtLogToggle").button();
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
	var nodes = network.body.data.nodes;
	var allNodes = nodes.get({returnType:"Object"});
	var selectedNodeIds = network.getSelectedNodes();
  var nodeId;

	if (highlightActive === true) {
		// reset all nodes / restore 'normal' view
		for (nodeId in allNodes) {
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
		highlightActive = false;
	}


	// if something is selected -> highlight it
    if (selectedNodeIds.length > 0) {
		highlightActive = true;

		// mark all non-selected nodes as hard to read.
		for (nodeId in allNodes) {
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

//
// Methods for calculating / displaying the current traffic on the network (using RtLogs)
//

// updates the visual appearance of all edges (according to collected traffic-data)
function updateEdgeTraffic(displayTraffic){
  console.log("updating edges");

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
		trafficPerEdge[edge.id] = (clientTraffic[edge.from] + clientTraffic[edge.to])/2; // mean traffic
		if(trafficPerEdge[edge.id] > maxTraffic) maxTraffic = trafficPerEdge[edge.id];
	}

	// update edge width ( trafficPerEdge / maxTraffic)
	for(edgeId in allEdges) {
    if(displayTraffic){
      allEdges[edgeId].width = (trafficPerEdge[edgeId] / maxTraffic) * 10;
      allEdges[edgeId].label = Math.round(((8* trafficPerEdge[edgeId]) / 1000)) + " [kbps]";
    }else {
      allEdges[edgeId].width = initialEdgeWidths[edgeId];
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
		layer = (lastConsumedSegmentInfo[clientId] === undefined) ? -1 : lastConsumedSegmentInfo[clientId].layer;
		node = allNodes[clientId];
		node.image = getClientImageUrl((layer == -1) ? "" : layer,clientScreenFillColors[layer+1],clientScreenFontColors[layer+1]);
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
    node.image = getClientImageUrl("",clientScreenFillColors[0],clientScreenFontColors[0]);
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

	var data = {
    labels: [
        "L2 (" + Math.round((lvlStatistic[2] / sum) * 100) + "%)",
        "L1 (" + Math.round((lvlStatistic[1] / sum) * 100) + "%)",
        "L0 (" + Math.round((lvlStatistic[0] / sum) * 100) + "%)"
    ],
    datasets: [
        {
            data: lvlStatistic.reverse(), // necessary, because we start with 0 at the bottom (last element)
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
		type:'doughnut',
		data: data
	});

	myPieChart.resize();

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
  console.log("showNodeCoolTip!");
  if(isNaN(id)) return;
  var firstTime = ($("#" + id).length === 0);

  // calculate screen position
	var canvasPos = network.getPositions(id)[id];
	var pos = network.canvasToDOM(canvasPos);
	// apply horizontal correction for legend (legend is ...px wide)
	pos.x += $('#legendContainer').width();

	var nodeName = network.body.nodes[id].options.label + (network.body.nodes[id].options.hiddenLabel || "");
	var nodeColor = network.body.nodes[id].options.font.color;

  if(firstTime){
      $("body").append('<div id="' + id + '" title="'+ nodeName + '"></div>');
  }

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

  if(firstTime){
    // set default-height for Cooltip
    $("#"+id).css("height","130px");
  }
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
    console.log("clearing upateIntervals for PI" + id);
		clearInterval(NodeUpdateIntervals[id]);
    delete NodeUpdateIntervals[id];
    //delete rtLogNodeUpdateIntervals[id]; //TODO: needed elsewhere

		// Only remove non-pinned cooltips
		$("#" + id).parent().hide(function(){$("#" + id).remove();});
	}
}

// updates the node-cooltip of a given client(-id)
function updateNodeCooltip(id){
  console.log("->updating node cooltip #" + id);
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
// methods for displaying and updating a TimeLine-overview of
// the last consumed SVC RepresentationId
//

// creates and shows a Timeline-Chart displaying the consumed SVC RepresentationIds
// of a given client(-id)
function showNodeRtLogview(id){
  var firstTime = ($("#rtLogview" + id).length === 0);
  console.log("show rtlog for pi" + id);
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
      // setup periodic updates
      if(rtLogNodeUpdateIntervals[id] !== undefined){
        rtLogNodeUpdateIntervals[id] = setInterval(updateNodeRtLogView(id));
      }
    },
    beforeClose: function(event,ui){
      // stop the periudic ui-updates
      clearInterval(rtLogNodeUpdateIntervals[id]);
      delete rtLogNodeUpdateIntervals[id];
    },
    create: function(event, ui) {
			widget = $(this).dialog("widget");
			$(".ui-dialog-titlebar",widget).css("color",nodeColor);
		},
    width: 600,
    height: 400,
    position: { my: "left top", at: "left+" + pos.x +" top+"+pos.y, of: window }
  });

  if(firstTime){
    clientCharts[id] = c3.generate({
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
                       return (d-1);
                     }
                }
            }
        },
        tooltip: {show: false},
        subchart: {show: true},
        zoom: {enabled: true},
        interaction: {enabled: true},
        legend: {show: false},
    });
  }
}

// update the Timeline-Chart of a given Client(-id) using a given rtLogfile
function updateNodeRtLogView(id, logfile){
  if((!$("#rtLogview" + id).is(":visible")) || (clientCharts[id] === undefined)) return;

  // seperate lines
  var newEntries = [];
  var segmentNumbers=[];
  var lines = logfile.split("\n");
  var quality;

  for(var index = Math.max(lines.length-200,0); index < lines.length; index++){
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
}


//
// Misc
//

// Takes a array containing the edge information and returns a proper
// html-info-thing,
// n1,n2,bandwidth in kbits a -> b, bandwidth in kbits a <- b,
// delay a -> b in ms, delay b -> a in ms
// TODO: replace by cooltip!
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



//
// Utility Methods
//

function getFiles(){
  requestedJsonFiles.forEach(function(id){
    console.log("fetching jsonfile for" + id);
    getJsonFile(id,undefined);
  });
  requestedRtLogFiles.forEach(function(id){
    console.log("fetching rtLogFile for" + id);
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
      console.log("received " + getJsonFileName(id));
			var jsonData = parseJSON(rawJsonString);
			if(jsonData === null) return;

			// cache locally
			if(clientJson[id] === undefined){
				clientJson[id] = {previous: undefined, current: jsonData};
				// no previous value, traffic is zero
				clientTraffic[id] = 0;
			}
			else{
				clientJson[id].previous = clientJson[id].current;
				clientJson[id].current = jsonData;
				// traffic = (tx_2 - tx_1) - (rx_2 - rx_1) [bytes]
				if(clientJson[id].current.date != clientJson[id].previous.date){ // deal with reading the same file several times
					/* different file! */
          // indicate that at least 2 jsonFiles have arrived
          if(!initialTrafficInfoReceived) initialTrafficInfoReceived = true;

          // time interval between prev. and current json-file
          elapsedSeconds = Math.abs((parseDate(clientJson[id].current.date) - parseDate(clientJson[id].previous.date)))/1000;

					clientTraffic[id] = (Math.abs(parseInt(clientJson[id].current.txbytes) - parseInt(clientJson[id].previous.txbytes))) +
					(Math.abs(parseInt(clientJson[id].current.rxbytes) - parseInt(clientJson[id].previous.rxbytes)));
          clientTraffic[id] = Math.round(clientTraffic[id] / elapsedSeconds); // traffic now in bytes per second
				}else {/* same file!" */}
			}

			if(callback !== undefined){
				callback(id);
			}
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

		// access individual columns
		var columns = lastLine.split("\t");
		var clientInfo = {date: columns[0], layer: parseInt(columns[4])};

		// TODO: check dates?
		//if((lastConsumedSegmentInfo[id] === undefined || Date.parse(lastConsumedSegmentInfo[id].date) < Date.parse(clientInfo.date)) & !isNaN(columns[4]))
		lastConsumedSegmentInfo[id] = clientInfo;
    clientRtLogs[id] = data;
    initialRtLogReceived = true; // we received a rtlog-file
		//console.log("updating logInfo for PI_"+id);

    // Update svc layer chart
    updateNodeRtLogView(id,data);
    })
    .fail(function() {
        console.log("failed retrieving logfile for PI_" + id);
        // display default cold blue screen
        var clientInfo = {date: new Date(), layer: -1};
		lastConsumedSegmentInfo[id] = clientInfo;
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
