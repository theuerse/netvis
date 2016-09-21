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
      var trafficSpinner = new Spinner({color: '#3170a9',top: '-12px',left: '10px',shadow: true, position: 'relative'}).spin();
      $("#trafficBusyIndicator").append(trafficSpinner.el);
      $("#trafficBusyIndicator").hide();

      var rtLogSpinner = new Spinner({color: '#3170a9',top: '-12px',left: '10px',shadow: true, position: 'relative'}).spin();
      $("#rtLogBusyIndicator").append(rtLogSpinner.el);
      $("#rtLogBusyIndicator").hide();


	    // show loading animation (spinner)
	    $("#graphContainer").append(
			new Spinner({color: '#dcdcdc', scale: 3}).spin().el);

			setupSvgCache();

      console.log("ready!");

      // GET-param "top" overrides the path specified at the begining of the file
      if(getUrlVar("top") !== "") topologyFilePath = getUrlVar("top");

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

// Netvis - specific UI
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
  var step = 80;

  options.height = '265px'; // limit height, make room for additional information
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
  // display of min-/max bitrate of disabled for now
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
