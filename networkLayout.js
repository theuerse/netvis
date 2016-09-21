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
