var commandWindowText = [];
var commandWindowHistory = 5;

var colourDescriptions = { 'r': 'red', 'g': 'green', 'b':'blue' };
var colours = ['r', 'g', 'b'];
var comparisonCircleColour = "#6EF5AF";
var variableCircleColour = "#C200DB";
var otherCircleColour = "#003300";

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

var selectedObject, comparisonObject;
var width, height;	
var context;
var circles = false, labels=false, comparisonActive = false;
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
		displayStatus("Loading data");
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
		loadPNG();
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
			dictObject.comparisonFlags = dataObject.comparisonFlags;
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
		
		clearStatus();
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
			case 76: // 'l' pressed.... render the object labels
				toggleLabels();
				break;
			case 85: // 'u' pressed, use currently selected object as the comparison
				switchComparison();
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
		selectedObject = getObjectUnderMouseCursor(x, y)
		if (selectedObject!=null) {
			console.log(selectedObject);
			updateSelectedObject(selectedObject, false);
			drawChart(selectedObject);
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
	
	function displayStatus(message) {
		// Write the text over the canvas object in the <div> called StatusText
		$('#StatusText').html(message);
		$('#StatusText').css('visibility', 'visible');
	}
	
	function clearStatus() {
		// Hide the floating status message
		$('#StatusText').css('visibility', 'hidden');
	}

	function displayChartStatus(message) {
		// Write the text over the canvas object in the <div> called ChartStatus
		$('#ChartStatus').html(message);
		$('#ChartStatus').css('visibility', 'visible');
		console.log("Displaying ChartStatus:", message);	
	}
	
	function clearChartStatus() {
		// Hide the floating status message
		$('#ChartStatus').css('visibility', 'hidden');
	}
	
	
	function distance(x1, y1, x2, y2) {
		return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) )
	}
	
	function updateSelectedObject(object, comparison) {
		colours = ['r', 'g', 'b'];
		tableHTML = "<table>";
		if (!comparison) tableHTML+= "<tr><th colspan='3'>Selected</th></tr>";
		  else tableHTML+= "<tr><th colspan='3'>Comparison</th></tr>";
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
		if (!comparison) $('#SelectedObjectTable').html(tableHTML);
		  else $('#ComparisonObjectTable').html(tableHTML);

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
	
	function switchBaseImage(colour) {
		baseColour = colour;
		writeToCommandWindow('Switching to ' + colourDescriptions[colour] + ' base image.');
		redrawCanvas();
	}
	
	function loadPNG() {
		//load the image
		filename = runName + "_" + baseColour + ".png";
		var image = new Image();
		image.src = filename;
		console.log("Loading", imageFile);
		image.onload = function () { 
			context.drawImage(image, 0, 0);
			if (circles) drawCircles();
			if (labels) drawObjectLabels();
			if (comparisonActive) drawDiamond(comparisonObject);
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
			redrawCanvas();
		}
	}

	function toggleLabels() {
		if (!labels) {
			drawObjectLabels();
			labels = true;
		} else {
			labels = false;
			redrawCanvas();
		}
	}
	
	function redrawCanvas() {
		clearCanvas();
		loadPNG();
	}	
	
	function switchComparison() {
		if (comparisonActive) {
			comparisonActive = false;
			$('#ComparisonObjectTable').html("");
			comparisonObject = null;
			redrawCanvas();
			return
		}
		if (selectedObject!=null) {
			comparisonObject = selectedObject;
			console.log("New comparison object", comparisonObject);
			updateSelectedObject(comparisonObject, true);
			computeComparisonData(comparisonObject);
			drawDiamond(comparisonObject);
			comparisonActive = true;
		}
	}
			
	function drawDiamond(object) {
		r = 15;
		if (object.colourID[baseColour]!=-1) {
			meanPosition = object.meanPosition[baseColour];
			x = meanPosition[0];
			y = height - meanPosition[1];
			context.lineWidth = 2;
			context.strokeStyle = otherCircleColour;
			context.beginPath();
			context.moveTo(x, y+r);
			context.lineTo(x+r, y);
			context.lineTo(x, y-r);
			context.lineTo(x-r, y);
			context.closePath();
			context.stroke();
			
		}
	}
	
	function drawObjectLabels() {
		for (i in objectList) {
			object = objectList[i];
			if (object.colourID[baseColour]!=-1) {
				meanPosition = object.meanPosition[baseColour];
				isComparison = object.comparisonFlags[baseColour];
				x = meanPosition[0];
				y = height - meanPosition[1];
				context.fillStyle = "#000000";
				context.font = "bold 16px Arial";
				context.fillText(object.id, x, y);
			}
		}
	}		
	
	function drawCircles() {
      	context.lineWidth = 2;
      	context.strokeStyle = otherCircleColour;
		for (i in objectList) {
			object = objectList[i];
			if (object.colourID[baseColour]!=-1) {
				meanPosition = object.meanPosition[baseColour];
				isComparison = object.comparisonFlags[baseColour];
				x = meanPosition[0];
				y = height - meanPosition[1];
				context.beginPath();
				if (isComparison) {
					context.strokeStyle = comparisonCircleColour;
					}
				 else {
					context.strokeStyle = otherCircleColour;
				}
		      	context.arc(x, y, 15, 0, 2 * Math.PI, false);
				context.stroke();
		      	context.closePath();
				}
		}
		      	
	}


	function drawChart(object) {
		console.log("Drawing the chart of....");
		console.log(object);
		displayChartStatus("Drawing chart");
		
		
		var numColumns = 0;
		var coloursForChart = [];
		for (i in colours) {
			if (object.colourID[colours[i]]!=-1) {
				numColumns++;
				coloursForChart.push(colours[i]);
			}
		}
		
		console.log("Object has photometry for the following colours:", coloursForChart);
		
		headings = ["MJD"];
		for (i in coloursForChart) headings.push(colourDescriptions[coloursForChart[i]])
		
		chartData = [];
		chartData.length = 0; 
		
		chartData.push(headings);
		
		// Put the frame data into the data array
		for (var i in frameList) {
			MJD = frameList[i].MJD;
			temp = [ MJD ];
			for (var j in coloursForChart) {
				temp.push(null);
			}
			chartData.push(temp);
		}
		
		//console.log(frameList);
		
		for (var i in coloursForChart) {
			colour = coloursForChart[i];
			data = object.photometry[colour];
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				//console.log(data[j]);
				frameIndex = parseInt(data[j].frameIndex);
				//console.log(" -- ", frameList[frameIndex-1].c[colour]);
				if (comparisonActive) measurement = data[j].magnitude/frameList[frameIndex-1].c[colour];
				   else measurement = data[j].magnitude;
				chartData[frameIndex][colourIndex] = measurement;
			}
		}
		
		
		// Reveal the chart area...
		$('#main_chart_div').css('height', '400px');
		
		var dataTable = google.visualization.arrayToDataTable(chartData);

		var chartColours = [];
		for (var c in coloursForChart) {
			chartColours.push(colourDescriptions[coloursForChart[c]]);
		}

        var options = {
			title: 'Photometry for Object: ' + object.id,
			colors: chartColours, 
			pointSize: 1, 
			explorer: { actions: ['dragToZoom', 'rightClickToReset'] } 
        	}

        var chart = new google.visualization.ScatterChart(document.getElementById('main_chart_div'));
        google.visualization.events.addListener(chart, 'ready', chartReady);
        chart.draw(dataTable, options);

	}
	
	function chartReady() {
		clearChartStatus();
		console.log("Chart finished drawing");
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

