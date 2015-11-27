<?php
// associative array sporting the offered Files and their respective paths
$files = array(
	"generated_network_top.txt" => "pi-network/generated_network_top.txt", 
);

for($i=0; $i<20; $i++){
	$files += array("PI$i.json" => "pi-network/PI$i.json");
}


// get requested file , escape funky chars
$fileName = html_entity_decode($_GET["name"]);


// send file if it exists
if(file_exists($files[$fileName])){
	// read file content
	$fileData = file_get_contents($files[$fileName]);

	// "determine" content type (info for receiver)
 	$contentType = "Content-Type: text/plain";
	// if the requested File ends in .json => set contentType accordingly
	if(strrpos($fileName, ".json") == strlen($fileName) - strlen(".json")){
		$contentType = "'Content-type:application/json";
	}
	
	// Set contentType of following data (info for receiver)
	header($contentType);

	// Send the actual file content
	echo $fileData;

}else {
	echo "file not found";
}

?>
