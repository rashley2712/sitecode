var debugText = [];
var debugHistory = 15;
var commandWindowText = [];
var commandWindowHistory = 5;

var colourDescriptions = { 'r': 'red', 'g': 'green', 'b':'blue' };

var commandHelpHTML = "Available commands: <br/>\
					<b>c</b> - show object 'circles'. <br/>\
					<b>l</b> - show object labels (IDs). <br/>\
					<b>r</b> - switch base image to 'red'. <br/>\
					<b>g</b> - switch base image to 'green'.<br/>\
					<b>b</b> - switch base image to 'blue'.<br/>"

var masterObjectList = new Array();
var redObjectList = new Array();
var greenObjectList = new Array();
var blueObjectList = new Array();
var allObjects = {};
var baseCatalog = [];
var filteredObjectList = new Array();
var loadedMaster = false, loadedGreen = false, loadedRed = false, loadedBlue = false;
var loadedWCS = false;
var selectedObject;
var width, height;	
var context;
var circles = false;
var baseImage = 'r';

	function wcsSolution() {
		this.equinox = 0;	
	}
	
	wcsSolution.prototype.init = function(data){
		this.equinox = data.equinox;
		this.x_ref = data.x_ref;
		this.y_ref = data.y_ref;
		this.ra = data.ra;
		this.dec = data.dec;
		this.CD_1_1 = data.CD_1_1;
		this.CD_1_2 = data.CD_1_2;
		this.CD_2_1 = data.CD_2_1;
		this.CD_2_2 = data.CD_2_2;
	}

	wcsSolution.prototype.toString = function(){
		outStr = "RA: " + this.ra + " DEC: " + this.dec;
		return outStr;
	}
	
	wcsSolution.prototype.pixelToWorld = function(x, y) {
		abs_x = x - this.x_ref;
		abs_y = y - this.y_ref;
		world_x = this.CD_1_1 * abs_x + this.CD_1_2 * abs_y;
		world_y = this.CD_2_1 * abs_x + this.CD_2_2 * abs_y;
		
		world_x = world_x + this.ra
		world_y = world_y + this.dec
		
		worldCoord = {wx: world_x, wy: world_y}
		
		return worldCoord;
	}
	
	
	function eventWindowLoaded() {
		debug("Loading the JSON data");
		writeToCommandWindow("Run: " + runName);
		writeToCommandWindow("Loading the object data... please wait...");
		rgbJSONFile = runName + "_rgb.json";
		rJSONFile = runName + "_r.json";
		gJSONFile = runName + "_g.json";
		bJSONFile = runName + "_b.json";
		imageFile = runName + "_" + baseImage + ".png";
		wcsSolutionFile = runName + "_r_wcs.json"
		
		$.getJSON(wcsSolutionFile, wcsLoaded);
		$.getJSON(rgbJSONFile, jsonLoadedRGB);
		$.getJSON(rJSONFile, function (data) {
			console.log("got the data for the red channel");
			loadedRed = parseObjectData(data, redObjectList, "#rStatus");
			allObjects['r'] = redObjectList;
			checkAllDataLoaded();
			});
		$.getJSON(gJSONFile, function (data) {
			console.log("got the data for the green channel");
			loadedGreen = parseObjectData(data, greenObjectList, "#gStatus");
			allObjects['g'] = greenObjectList;
			checkAllDataLoaded();
			});
		$.getJSON(bJSONFile, function (data) {
			console.log("got the data for the blue channel");
			loadedBlue = parseObjectData(data, blueObjectList, "#bStatus");
			allObjects['b'] = blueObjectList;
			checkAllDataLoaded();
			});
		initCanvas();
		clearCanvas();
		loadPNG(imageFile);
		document.onkeydown = handleKeyPressed;
	}
	
	function wcsLoaded(data) {
		console.log("Loaded the WCS data");
		console.log(data);
		wcsSolutionRed = new wcsSolution();
		
		wcsSolutionRed.init(data);
		
		console.log("WCS loaded: Equinox is: "+ wcsSolutionRed.equinox);
		
		debug("WCS solution: " + wcsSolutionRed.toString());

		console.log("Trial world: ");
		console.log(wcsSolutionRed.pixelToWorld(500,500));
		loadedWCS = true;
	}
	
	function degToSexString(angle) {
		degrees = Math.floor(angle);
		remainder = angle - degrees;
		minutes = Math.floor(remainder * 60);
		seconds = ((remainder * 60) - minutes) * 60;
		
		outStr = $.format.number(degrees, '00') + ":" + $.format.number(minutes,'00') + ":" + $.format.number(seconds, '00.000');
		
		return outStr;
	}
	
	function checkAllDataLoaded() {
		if (!loadedMaster) return;
		if (!loadedRed) return;
		if (!loadedGreen) return;
		if (!loadedBlue) return;
		
		debug("All data successfully loaded");
		console.log("All data successfully loaded.");
		writeToCommandWindow("Data loaded.");
		writeToCommandWindow("Press 'h' for a list of commands.");
		
		baseCatalog = allObjects['r'];
		console.log("Set the base catalog to 'r'");
		
		// Get the x,y position from the red channel
		console.log(masterObjectList.length)
		for (var i=0; i<masterObjectList.length; i++) {
			masterObject = masterObjectList[i]
			object = getObjectById(redObjectList, masterObject.r);
			if (object!=null) {
				masterObjectList[i].x = object.x; 
				masterObjectList[i].y = object.y;
			} else {
				masterObjectList[i].x = 0;
				masterObjectList[i].y = 0;
			}  
		}
		drawObjectTable();
		//toggleCircles();
	}
	
	function handleKeyPressed(e) {
		e = e?e:window.event;
		console.log(e.keyCode + " pressed");

		switch(e.keyCode) {
			case 67: //Toggle the circles
				toggleCircles();
				break;
			case 82: // 'r' pressed switch to red image
				switchBaseImage('r');
				break;
			case 71: // 'g' pressed, switch to green image
				switchBaseImage('g');
				break;
			case 66: // 'b' pressed, switch to blue image
				switchBaseImage('b');
				break;
			case 72: // 'h' pressed, show the help message
				writeToCommandWindow(commandHelpHTML);
				break;
		}
	}
		
	function listObjects() {
		for (var i in masterObjectList) {
			object = masterObjectList[i]
			console.log(object.id + " (" + object.x + ", " + object.y +") frames: " + object.data.length + " last counts: " + object.data[object.data.length-1][1])
		}
	}
	
	function getObjectById(objects, id) {
		for (var i in objects) {
			if (objects[i].id == id) return objects[i]
		}
		
		return null
	}
	
	function objectTable(objectList) {
		tableString = "<table>";
		
		tableString+= "<tr><th>ID</th><th>Red channel</th><th>Green channel</th><th>Blue channel</th></tr>";
		for (i in objectList) {
			tableString+= "<tr>";
			object = objectList[i]
			tableString+= "<td>" + object.id;
			tableString+=" (" + parseInt(object.x) + ", " + parseInt(object.y)  + ")";
			tableString+= "</td>";
			if (object.r!=-1) {
				redObject = getObjectById(redObjectList, object.r);
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(redObject.x) + ", " + parseInt(redObject.y) + ")</td>";
				tableString+="<td>[" + redObject.data.length +  "]</td>";
				tableString+="</tr>";				
				tableString+="</table></td>";				
			} else {
				tableString+="<td>none</td>"
			}
			if (object.g!=-1) {
				greenObject = getObjectById(greenObjectList, object.g);
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(greenObject.x) + ", " + parseInt(greenObject.y)  + ")</td>";
				tableString+="<td>[" + greenObject.data.length +  "]</td>";
				tableString+="</tr>";				
				tableString+="</table></td>";				
			} else {
				tableString+="<td>none</td>"
			}
			if (object.b!=-1) {
				blueObject = getObjectById(blueObjectList, object.b);
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(blueObject.x) + ", " + parseInt(blueObject.y)  + ")</td>";
				tableString+="<td>[" + blueObject.data.length +  "]</td>";
				tableString+="</tr>";				
				tableString+="</table></td>";				
			} else {
				tableString+="<td>none</td>"
			}
			
			tableString+= "</tr>";
		}
		tableString+= "</table>";
		
		return tableString;
	}
	
	function drawObjectTable() {
		htmlString =  objectTable(masterObjectList);
		$('#ObjectTable').html(htmlString);
	}
	
	function jsonLoadedRGB(data) {
		numberObjects = data.length;
		debug(numberObjects + " colour objects loaded");
		masterObjectList = [];
		for (var i in data) {
			dataLine = data[i]
			dataObject = JSON.parse(dataLine);		
			masterObjectList.push(dataObject);
			}
		loadedMaster = true;
		checkAllDataLoaded();
		console.log(masterObjectList.length + " objects parsed.");
		for (var i in masterObjectList) {
			console.log(i);
			console.log(masterObjectList[i]);
		}
	}

	function parseObjectData(data, objectList, statusAttribute) {
		numberObjects = data.length;
		debug(numberObjects + " objects loaded " + statusAttribute);
		if (objectList.length!=0) {
			console.log("The objectList wasn't empty.... won't load new ones.");
			return false;
		}
		for (i in data) {
			dataLine = data[i]
			dataObject = JSON.parse(dataLine);		
			objectList.push(dataObject);
			//console.log(dataObject);
			}

		$(statusAttribute).attr('class', 'statusOK');
		
		return true;
	}

	
	function clearCanvas() {
		// Clear the canvas area
		context.fillStyle = "#aaaaaa";
		context.fillRect(0, 0, width, height);
		context.fillStyle = "#000000";	
	}
	
	function initCanvas() {
		
		theCanvas = document.getElementById("ImageCanvas");
		context = theCanvas.getContext("2d");
		
		theCanvas.addEventListener('mousedown', mouseClicked);
		theCanvas.addEventListener('mousemove', mouseMoved);
		
		width = theCanvas.width;
		height = theCanvas.height;
	}
	
	function mouseClicked(evt) {
		console.log("Mouse clicked");
		x = parseInt(evt.offsetX)
		y = height - parseInt(evt.offsetY)
		if (isNaN(x)) {
			x = evt.layerX;
			y = height - evt.layerY;
		}
		currentObject = getObjectUnderMouseCursor(x, y)
		console.log(currentObject);
		if (currentObject!=0) {
			updateSelectedObject(currentObject)
		}
	}
	
	function mouseMoved(evt) {
		var x = parseInt(evt.offsetX);
		var y = height - parseInt(evt.offsetY);
		if (isNaN(x)) {
			x = evt.layerX;
			y = height - evt.layerY;
		}
		
		windowY = height - y;
		
		cursorString = " (" + x + ", " + y + ")";
		currentObject = getObjectUnderMouseCursor(x, y);
		if (currentObject!=0) cursorString+= " [" + currentObject.id + "]";
		$('#MouseLocation').text(cursorString);

		if (loadedWCS) {
			worldLocation = wcsSolutionRed.pixelToWorld(x, y);
			worldLocationString = "&alpha;:" + degToSexString(worldLocation.wx / 15);
			worldLocationString+= "<br/>&delta;:" + degToSexString(worldLocation.wy);
			$('#MouseWorldLocation').html(worldLocationString);
		}
		
		// Move the location of the 'hovertext'
		$('#HoverText').css('left', (x+10) + 'px');
		$('#HoverText').css('top', windowY+10 + 'px');
		if (loadedWCS) {
			$('#HoverText').html(worldLocationString);
		} else  {
			$('#HoverText').html(cursorString);
		}
		if (currentObject!=0) {
			$('#HoverText').css('background-color', 'green');
		} else {
			$('#HoverText').css('background-color', '#000000');
		}

	}
	
	function distance(x1, y1, x2, y2) {
		return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) )
	}
	
	function updateSelectedObject(object) {
		selectedObject = object;
		tableHTML = "<table>";
		tableHTML+= "<tr><td>" + selectedObject.id + "</td><td>(" + parseInt(selectedObject.x) + ", " + parseInt(selectedObject.y) + ")</td></tr>";
		tableHTML+= "</table>";
		$('#SelectedObjectTable').html(tableHTML);
		drawChartR();
		drawChartG();
		drawChartB();
	}
	
	function getObjectUnderMouseCursor(x, y) {
		object = 0;
		objectReference = 0;
		for (i in baseCatalog) {
		 	ox = baseCatalog[i].x;
		 	oy = baseCatalog[i].y;
			if (distance(x, y, ox, oy)<15) objectReference = baseCatalog[i]
			}
		if (objectReference!=0) object = lookupMasterObject(objectReference.id, baseImage);
		return object
	}
	
	function lookupMasterObject(id, colour) {
		if (colour=='r') {
			for (var i in masterObjectList) if (masterObjectList[i].r == id) return masterObjectList[i];
		}
		if (colour=='g') {
			for (var i in masterObjectList) if (masterObjectList[i].g == id) return masterObjectList[i];
		}
		if (colour=='b') {
			for (var i in masterObjectList) if (masterObjectList[i].b == id) return masterObjectList[i];
		}
		
	}
	
	function switchBaseImage(colour) {
		imageFile = runName + "_" + colour + ".png";
		baseImage = colour;
		baseCatalog = allObjects[colour];
		writeToCommandWindow('Switching to ' + colourDescriptions[colour] + ' base image.');
		loadPNG(imageFile);
		if (circles) drawCircles();
		
	}
	
	function loadPNG(filename) {
		//load the image
		var image = new Image();
		image.src = filename;
		image.onload = function () { 
			context.drawImage(image, 0, 0);
			if (circles) drawCircles();
			}
	}
	
	function filterObjects(objectList) {
		returnList = new Array();
		for (i in objectList) {
			if (objectList[i].data.length > 1) returnList.push(objectList[i])
		}
		
		return returnList;
	}
	
	function toggleCircles() {
		if (!circles) {
			drawCircles();
			circles = true;
		} else {
			circles = false;
			undrawCircles();
		}
	}
	
	function undrawCircles() {
		clearCanvas();
		loadPNG(imageFile);
	}			
	
	function drawCircles() {
		console.log("Drawing circles");
      		context.lineWidth = 2;
      		context.strokeStyle = '#003300';
      		objects = allObjects[baseImage];
		for (i in objects) {
			x = objects[i].x
			y = height - objects[i].y
			//console.log(x, y)
			context.beginPath();
	      		context.arc(x, y, 15, 0, 2 * Math.PI, false);
	      		context.stroke();
		}
		context.closePath();
		
	}
	
	function drawChartR() {
		var dataArray = [['MJD', 'Counts']];
		// Do the red channel
		if (selectedObject.r!=-1) {
			// Reveal the chart area
			$('#chart_div_r').css('height', '400px');
			object = getObjectById(redObjectList, selectedObject.r);
			for (i=0; i<object.data.length; i++) {
				//console.log("MJD: " + redObject.data[i][0] + " Counts:" + redObject.data[i][1]);
				if (object.data[i][0]!=51544) {
					temp = [object.data[i][0], object.data[i][1]];
					dataArray.push(temp);
				}
			}
		} else {
			// Hide the chart area
			$('#chart_div_r').css('height', '0px');
			$('#chart_div_r').empty();
			return;
		}
	        	
		var dataTable = google.visualization.arrayToDataTable(dataArray);

        var options = {
			title: 'Counts for Object: ' + selectedObject.id,
			colors: ['red', 'green', 'blue']
        	}

        var chart = new google.visualization.LineChart(document.getElementById('chart_div_r'));
        chart.draw(dataTable, options);
	}

	function drawChartG() {
		var dataArray = [['MJD', 'Counts']];
		// Do the green channel
		if (selectedObject.g!=-1) {
			// Reveal the chart area
			$('#chart_div_g').css('height', '400px');
			object = getObjectById(greenObjectList, selectedObject.g);
			for (i=0; i<object.data.length; i++) {
				if (object.data[i][0]!=51544) {
					temp = [object.data[i][0], object.data[i][1]];
					dataArray.push(temp);
				}
			}
		} else {
			// Hide the chart area
			$('#chart_div_g').css('height', '0px');
			$('#chart_div_g').empty();
			return;
		}
	        	
		var dataTable = google.visualization.arrayToDataTable(dataArray);

        var options = {
			title: 'Counts for Object: ' + selectedObject.id,
			colors: ['green']
        	}

        var chart = new google.visualization.LineChart(document.getElementById('chart_div_g'));
        chart.draw(dataTable, options);
	}

	function drawChartB() {
		var dataArray = [['MJD', 'Counts']];
		// Do the blue channel
		if (selectedObject.b!=-1) {
			// Reveal the chart area
			$('#chart_div_b').css('height', '400px');
			object = getObjectById(blueObjectList, selectedObject.b);
			for (i=0; i<object.data.length; i++) {
				if (object.data[i][0]!=51544) {
					temp = [object.data[i][0], object.data[i][1]];
					dataArray.push(temp);
				}
			}
		} else {
			// Hide the chart area
			$('#chart_div_b').css('height', '0px');
			$('#chart_div_b').empty();
			return;
		}
	        	
		var dataTable = google.visualization.arrayToDataTable(dataArray);

        var options = {
			title: 'Counts for Object: ' + selectedObject.id + ' blueID: ' + selectedObject.b,
			colors: ['blue']
        	}
        var chart = new google.visualization.LineChart(document.getElementById('chart_div_b'));
        chart.draw(dataTable, options);
	}

function writeToCommandWindow(text) {
	if (commandWindowText.length > commandWindowHistory) {
		commandWindowText.shift();
	}
	
	commandWindowText.push(String(text));
	
	commandWindowHTML = "";
	for (var i in commandWindowText) {
		commandWindowHTML+= commandWindowText[i] + "<br/>";
	}
	
	$('#commandWindow').html(commandWindowHTML);

}

function debug(debugString) {
	if (debugText.length>debugHistory) {
		debugText.shift();
	}
	
	dateString = formatTime(new Date());
	
	debugText.push(String(dateString + " : " + debugString));
	
	debugHTML = "";
	for (i in debugText) {
		debugHTML+= debugText[i] + "<br/>";		
	}
	
	$('#debugPanel').html(debugHTML);
}

function formatTime(date) {
	var hours;
	var minutes;
	var seconds;
	var millis;
	var timeString;
	
	hours = date.getHours();
 	minutes = date.getMinutes();
	seconds = date.getSeconds();
	millis = date.getMilliseconds();
	
	if (hours<10) hours = "0" + hours;
	if (seconds<10) seconds = "0" + seconds;
	if (minutes<10) minutes = "0" + minutes;
	if (millis<100) millis = "0" + millis;
	if (millis<10) millis = "0" + millis;
	
	timeString = hours + ":" + minutes + ":" + seconds + "." + millis;
	return timeString;
}

function zfill(num, len) {
	return (Array(len).join("0") + num).slice(-len);}

