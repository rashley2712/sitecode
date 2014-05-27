var commandWindowText = [];
var commandWindowHistory = 5;

var colourDescriptions = { 'r': 'red', 'g': 'green', 'b':'blue' };
var colours = ['r', 'g', 'b'];

var commandHelpHTML = "Available commands: <br/>\
					<b>c</b> - show object 'circles'. <br/>\
					<b>l</b> - show object labels (IDs). <br/>\
					<b>r</b> - switch base image to 'red'. <br/>\
					<b>g</b> - switch base image to 'green'.<br/>\
					<b>b</b> - switch base image to 'blue'.<br/>\
					"

var runInfo = {};
var objectList = new Array();		 
var frameList = new Array();
var loadedWCS = false;
var loadedRunInfo = false;
var loadedObjectInfo = false;
var loadedFrameInfo = false;

var selectedObject;
var width, height;	
var context;
var circles = false;
var baseColour = 'r';

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
		imageFile = runName + "_" + baseColour + ".png";
		wcsSolutionFile = runName + "_r_wcs.json";
		runInfoJSONFile = runName + "_info.json";
		objectJSONFile = runName + "_objects.json";
		frameJSONFile = runName + "_frameInfo.json";
		
		$.getJSON(wcsSolutionFile, wcsLoaded);

		$.getJSON(runInfoJSONFile, function(data) {
					runInfo = data;
					console.log("Run info:");
					console.log(runInfo);
					loadedRunInfo = true;
					updateRunInfoTable();
					checkAllDataLoaded();
				});

		$.getJSON(objectJSONFile, parseLoadedObjects);
		//loadJSON(objectJSONFile, parseLoadedObjects);
		$.getJSON(frameJSONFile, parseFrameData);
		
		initCanvas();
		clearCanvas();
		loadPNG(imageFile);
		document.onkeydown = handleKeyPressed;
	}
	
	function loadJSON(path, callback) {   
		var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
		xobj.open('GET', path, true); // Replace 'my_data' with the path to your file
		console.log(xobj);
		xobj.onreadystatechange = function () {
			if (xobj.readyState == 4 && xobj.status == "200") {
				// Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
				callback(xobj.responseText);
			}
		};
		xobj.send(null);  
		}
	
	function parseLoadedObjects(data) {
		console.log("About to parse objects");
		// Reset the objectList
		objectList = []
		
		for (var i in data) {
			dataObject = JSON.parse(data[i]);
			//console.log(dataObject);
			dictObject = {};
			dictObject.id = dataObject.id;
			dictObject.isComparison = dataObject.isComparison;
			dictObject.meanPosition = {'r': [dataObject.meanPosition['r'][0], dataObject.meanPosition['r'][1]], 
				                       'g': [dataObject.meanPosition['g'][0], dataObject.meanPosition['g'][1]],
				                       'b': [dataObject.meanPosition['b'][0], dataObject.meanPosition['b'][1]]};
			dictObject.colourID = {'r': dataObject.colourID['r'], 'g': dataObject.colourID['g'], 'b': dataObject.colourID['b'] }
			dictObject.photometry = {'r': [], 'g':[], 'b':[] };
			for (c in colours) {
				photoData = dataObject.photometry[colours[c]];
				//console.log(photoData);
				for (m in photoData) {
					position = [ photoData[m][3], photoData[m][4] ];
					exposure = {'frameIndex': photoData[m][0], 
						        'magnitude' : photoData[m][1], 
						        'fwhm'      : photoData[m][2],
						        'position'  : position};
						        
					dictObject.photometry[colours[c]].push(exposure);
				}
			}
			objectList.push(dictObject);
			//console.log(dictObject);
		}

		console.log(objectList.length + " objects loaded");

		loadedObjectInfo = true;
		checkAllDataLoaded();
	
	}

	function parseFrameData(data) {
		// Reset the frameList
		frameList = [];
		
		for (var i in data) {
			dataObject = JSON.parse(data[i]);
			frameList.push(dataObject);
		}
		console.log("Frame info:");
		console.log(frameList.length + " frames");

		loadedFrameInfo = true;
		checkAllDataLoaded();
		
	}

	
	function updateRunInfoTable() {
		$('#date').text(runInfo.date);
		$('#runName').text(runInfo.runID);
		$('#comments').text(runInfo.comment);
		$('#runName').text(runInfo.runID);
		targetString = runInfo.objectID;
		if (runInfo.target!=runInfo.objectID) targetString+= "<br/>" + runInfo.target;
		$('#object').html(targetString);
		raString = degToSexString(runInfo.ra);
		decString = degToSexString(runInfo.dec);
		radecString = "&alpha;:" + raString + " &delta;:" + decString;
		$('#radec').html(radecString);
	}
	
	
	function wcsLoaded(data) {
		console.log("WCS data:");
		console.log(data);
		wcsSolutionRed = new wcsSolution();
		wcsSolutionRed.init(data);
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
		if (!loadedRunInfo) return;
		if (!loadedObjectInfo) return;
		if (!loadedFrameInfo) return;
		
		debug("All data successfully loaded");
		console.log("All data successfully loaded.");
		writeToCommandWindow("All data loaded.");
		writeToCommandWindow("Press 'h' for a list of commands.");
		
		//drawObjectTable();
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
		
	function objectTable(objectList) {
		tableString = "<table>";
		
		tableString+= "<tr><th>ID</th><th>Red channel</th><th>Green channel</th><th>Blue channel</th></tr>";
		for (i in objectList) {
			tableString+= "<tr>";
			object = objectList[i]
			tableString+= "<td>" + object.id;
			tableString+= "</td>";
			console.log(object);
			
			if (object.colourID.r!=-1) {
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(object.meanPosition.r[0]) + ", " + parseInt(object.meanPosition.r[1]) + ")</td>";
				tableString+="<td>[" + object.photometry.r.length +  "]</td>";
				tableString+="</tr>";				
				tableString+="</table></td>";				
			} else {
				tableString+="<td>none</td>"
			}
			if (object.colourID.g!=-1) {
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(object.meanPosition.g[0]) + ", " + parseInt(object.meanPosition.g[1])  + ")</td>";
				tableString+="<td>[" + object.photometry.g.length +  "]</td>";
				tableString+="</tr>";				
				tableString+="</table></td>";				
			} else {
				tableString+="<td>none</td>"
			}
			if (object.colourID.b!=-1) {
				tableString+="<td><table>";
				tableString+="<tr>";
				tableString+="<td>(" + parseInt(object.meanPosition.b[0]) + ", " + parseInt(object.meanPosition.b[1])  + ")</td>";
				tableString+="<td>[" + object.photometry.b.length +  "]</td>";
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
		htmlString =  objectTable(objectList);
		$('#ObjectTable').html(htmlString);
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
		if (currentObject!=null) {
			console.log(currentObject);
			updateSelectedObject(currentObject);
			drawChart(currentObject);
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
		//if (currentObject!=null) cursorString+= " [" + currentObject.id + "]";
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
		if (currentObject!=null) {
			$('#HoverText').css('background-color', 'green');
		} else {
			$('#HoverText').css('background-color', '#000000');
		}

	}
	
	function distance(x1, y1, x2, y2) {
		return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) )
	}
	
	function updateSelectedObject(object) {
		colours = ['r', 'g', 'b'];
		tableHTML = "<table>";
		tableHTML+= "<tr><th>ID</th><th>Position</th><th>Data points</th></tr>";

		tableHTML+= "<tr><td>" + object.id + "</td>"

		tableHTML+= "<td>";
		for (var i in colours) {
			if (object.colourID[colours[i]] != -1)
				tableHTML+= colours[i] + "(" + parseInt(object.meanPosition[colours[i]][0]) + ", " + parseInt(object.meanPosition[colours[i]][1]) + ")<br/>";
		}
		tableHTML+= "</td>";

		tableHTML+= "<td>";
		for (var i in colours) {
			if (object.colourID[colours[i]] != -1)
				tableHTML+= colours[i] + " : " + object.photometry[colours[i]].length + "<br/>";
		}
		tableHTML+= "</td>";

		tableHTML+= "</tr>";
		tableHTML+= "</table>";
		$('#SelectedObjectTable').html(tableHTML);

	}
	
	function getObjectUnderMouseCursor(x, y) {
		object = null;
		for (i in objectList) {
			if (objectList[i].colourID[baseColour]!=-1) {
				ox = objectList[i].meanPosition[baseColour][0];
				oy = objectList[i].meanPosition[baseColour][1];
				if (distance(x, y, ox, oy)<15) object = objectList[i]
			}
		}
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
		baseColour = colour;
		writeToCommandWindow('Switching to ' + colourDescriptions[colour] + ' base image.');
		loadPNG(imageFile);
		
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
      	context.lineWidth = 2;
      	context.strokeStyle = '#003300';
		for (i in objectList) {
			object = objectList[i];
			if (object.colourID[baseColour]!=-1) {
				meanPosition = object.meanPosition[baseColour];
				x = meanPosition[0];
				y = height - meanPosition[1];
				context.beginPath();
		      		context.arc(x, y, 15, 0, 2 * Math.PI, false);
		      		context.stroke();
				}
		}
		context.closePath();
		
	}


	function drawChart(object) {
		console.log("Drawing the chart of....");
		console.log(object);
		
		rData = object.photometry['r'];
		
		var numColumns = 0;
		var coloursForChart = [];
		for (i in colours) {
			if (object.colourID[colours[i]]!=-1) {
				numColumns++;
				coloursForChart.push(colours[i]);
			}
		}
		
		console.log(coloursForChart);
		
		headings = ["MJD"];
		for (i in coloursForChart) headings.push(colourDescriptions[coloursForChart[i]])
		
		chartData = [];
		chartData.length = 0; 
		
		chartData.push(headings);
		
		console.log("Headings");
		console.log(headings);
		console.log(chartData);
		console.log("That was the chart data");
		
		// Put the frame data into the data array
		for (var i in frameList) {
			MJD = frameList[i].MJD;
			temp = [ MJD ];
			for (var j in coloursForChart) {
				temp.push(null);
			}
			chartData.push(temp);
		}
		
		for (var i in coloursForChart) {
			colour = coloursForChart[i];
			data = object.photometry[colour];
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				//console.log(data[j]);
				frameIndex = parseInt(data[j].frameIndex);
				chartData[frameIndex][colourIndex] = data[j].magnitude;
			}
		}
		
		
		//console.log(chartData);
		
		// Reveal the chart area...
		$('#main_chart_div').css('height', '400px');
		
		var dataTable = google.visualization.arrayToDataTable(chartData);

        var options = {
			title: 'Photometry for Object: ' + object.id,
			colors: ['red', 'green', 'blue'], 
			pointSize: 1
        	}

        var chart = new google.visualization.ScatterChart(document.getElementById('main_chart_div'));
        chart.draw(dataTable, options);

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

