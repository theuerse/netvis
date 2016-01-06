var clientImagePath = "res/img/client_zero.svg";
var svgCache = {};
var urlCache = {};

function setupSvgCache() {
	cacheFile(clientImagePath);
};

function cacheFile(path) {
	var svgString;
     // get file directly
     $.ajax({
		url: path,
		data: svgString,
		dataType: 'text',
		async:false, // synchronous request ??
		success: function(svgString) {
			svgCache[path] = {data: svgString};
			console.log("cached: " + path);
		}
	});			
}

// for now, displayedNumber should stay between 0 and 9
function getClientImageUrl(displayedNumber, screenFillColor, screenFontColor){
	var imgName = clientImagePath+"_"+displayedNumber+"_"+screenFillColor+"_"+screenFontColor;
	if(urlCache[imgName] === undefined){
		if(svgCache[clientImagePath] === undefined) cacheFile(clientImagePath);
	
		var svgString = svgCache[clientImagePath].data;
		
		// make changes to svg
		svgString = svgString.replace("$LVL$",displayedNumber);
		svgString = svgString.replace("$SCREENFILLCOLOR$",screenFillColor);
		svgString = svgString.replace("$SCREENFONTCOLOR$", screenFontColor);
		
		var DOMURL = window.URL || window.webkitURL || window;

		var img = new Image();
		var svg = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
		var url = DOMURL.createObjectURL(svg);
		urlCache[imgName] = url;
		console.log("created: " + url);
	}
	return urlCache[imgName];
}
