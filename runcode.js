var commandWindowText = [];
var commandWindowHistory = 5;

var colourDescriptions = { 'r': 'red', 'g': 'green', 'b':'blue' };
var colours = ['r', 'g', 'b'];
var comparisonCircleColour = "#6EF5AF";
var variableCircleColour = "#C200DB";
var otherCircleColour = "#003300";
var diamondColour = "#000000";
var squareColour = "#000000";


var canvasHelpHTML = "<b>Available commands:</b><br/>\
					<b>[m]</b> - show object <b>circles</b>. <br/>\
					<b>[l]</b> - show object <b>labels</b>. <br/>\
					<b>[r, g, b]</b> - switch base <b>image</b> colour. <br/>\
					<b>[c]</b> - set as <b>comparison</b> for this colour.<br/>\
					<b>[e]</b> - <b>export</b> the data in the current lightcurve to a csv file.<br/>\
					";
var canvasHelpActive = false;

var runInfo = {};
var objectList = new Array();		 
var frameList = new Array();
var loadedWCS = false;
var loadedRunInfo = false;
var loadedObjectInfo = false;
var loadedFrameInfo = false;
var image = null;
var mousePositionAbsolute = {x: 0, y: 0};
var runVersion = null;
var selectedObject = null;
var width, height;	
var context;
var circles = false, labels=false, selectionActive=false, normaliseActive = true;
var comparisonActive = true, objectTableActive=false;
var plotRed = true, plotGreen = true, plotBlue = true;
var comparisonObject = {r: -1, g: -1, b: -1};
var baseColour = 'g';

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
		if (runVersion == null) runVersion = 'primary';
		debug("Reduction version: " + runVersion);
		writeToCommandWindow("Loading the object data... please wait...");
		displayStatus("Loading data");
		if (runVersion=="primary") {
			wcsSolutionFile = runName + "_r_wcs.json";
			runInfoJSONFile = runName + "_info.json";
			objectJSONFile = runName + "_objects.json";
			frameJSONFile = runName + "_frameInfo.json";
		} else {
			wcsSolutionFile = runName + "_r_wcs.json";
			runInfoJSONFile = runName + "_" + runVersion + "_info.json";
			objectJSONFile = runName + "_" + runVersion + "_objects.json";
			frameJSONFile = runName + "_" + runVersion + "_frameInfo.json";
		}
		
		$.getJSON(wcsSolutionFile, wcsLoaded);

		$.getJSON(runInfoJSONFile, function(data) {
					runInfo = data;
					console.log("Run info:");
					console.log(runInfo);
					loadedRunInfo = true;
					updateRunInfoTable();
					checkAllDataLoaded();
				});

		var jqxhr = $.getJSON(objectJSONFile, parseLoadedObjects)
				.fail(function() {
				    console.log( "error" );
				    writeToCommandWindow("Could not find the object file: " + objectJSONFile);
				});
				
		$.getJSON(frameJSONFile, parseFrameData);
		
		initCanvas();
		loadPNG();
		setCheckBoxes();
		updateComparisonTable();
		document.onkeydown = handleKeyPressed;
	}
	
	function setCheckBoxes() {
		//if (comparisonActive) $('#usecomparison').prop("checked", true);
		$('#labels').prop("checked", labels);
		$('#circles').prop("checked", circles);
		$('#normalise').prop("checked", normaliseActive);
		$('#objecttable').prop("checked", objectTableActive);
		$('#usecomparison').prop("checked", comparisonActive);
		$('#baseimage_'+baseColour).prop("checked", true);
		$('#plotred').prop("checked", plotRed);
		$('#plotgreen').prop("checked", plotGreen);
		$('#plotblue').prop("checked", plotBlue);
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
			//console.log(dataObject);
		}
		console.log("Frame info:");
		console.log(frameList.length + " frames");
		
		// Check frame info for bad timing frames from the high cadence runs
		debug("Checking the frame timing info");
		maxMJD = 0;
		minMJD = 70000;
		for (var i in frameList) {
			frame = frameList[i];
			if (frame.MJD<minMJD) minMJD = frame.MJD;
			if (frame.MJD>maxMJD) maxMJD = frame.MJD;
		}
		debug("Min MJD: " + minMJD + " Max MJD: " + maxMJD);
		

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
		
		sexOptionsString = "";
		
		sexOptionsString+= "Magnitude derived from: " + runInfo.sexMagnitude + "<br/>";
		
		for (var p in runInfo.sexOptions) {
			sexOptionsString+=  p + ": " + runInfo.sexOptions[p] + "<br/>";
		}
		
		$('#sextractor').html(sexOptionsString);
		console.log('Extended runinfo:', runInfo.sexOptions);
	}
	
	
	function wcsLoaded(data) {
		console.log("WCS data:");
		console.log(data);
		wcsSolutionRed = new wcsSolution();
		wcsSolutionRed.init(data);
		loadedWCS = true;
	}
	
	
	function checkAllDataLoaded() {
		if (!loadedRunInfo) return;
		if (!loadedObjectInfo) return;
		if (!loadedFrameInfo) return;
		
		debug("All data successfully loaded");
		console.log("All data successfully loaded.");
		writeToCommandWindow("All data loaded.");
		writeToCommandWindow("Press [h] to show <b>help</b>.");
		
		writeToCommandWindow("Looking for a sensible comparison object for each colour...");
		if (comparisonActive) findComparisons();
		if (objectList.length<21) toggleLabels();
		clearStatus();
	}
	
	function findComparisons() {
		for (var j in colours) {
			colour = colours[j];
			for (var i in objectList) {
				object = objectList[i];
				if (object.comparisonFlags[colour]) {
					comparisonObject[colour] = object.id;
					console.log("Updated comparison object", comparisonObject);
					updateComparisonTable();
					recomputeComparisonData(comparisonObject[colour], colour);
					break;
				}
			}
		writeToCommandWindow("Chosen object id:" + comparisonObject[colour] + " for " + colourDescriptions[colour] + " comparison.");

		}
		drawComparisonChart();
		
		redrawCanvas();
		
	}
	
	function handleKeyPressed(e) {
		e = e?e:window.event;
		console.log(e.keyCode + " pressed");

		switch(e.keyCode) {
			case 77: // 'm' pressed. Toggle the circles
				toggleCircles();
				break;
			case 78: // 'n' pressed. Toggle the normalisation of the chart
				toggleNormalisation();
				break;
			case 82: // 'r' pressed. Switch to red image
				switchBaseImage('r');
				break;
			case 71: // 'g' pressed, switch to green image
				switchBaseImage('g');
				break;
			case 66: // 'b' pressed, switch to blue image
				switchBaseImage('b');
				break;
			case 72: // 'h' pressed, show the help message
				toggleChartHelp();
				break;
			case 76: // 'l' pressed.... render the object labels
				toggleLabels();
				break;
			case 67: // 'c' pressed, use currently selected object as the comparison
				updateComparison();
				break;
			case 69: // 'e' pressed, export the currently displayed chart to a CSV file
				exportToCSV(selectedObject);
				break;
			case 37: // 'left arrow' pressed, go to the previous light curve in the list
				previousLightCurve();
				break;
			case 39: // 'right arrow' pressed, go to the next light curve in the list
				nextLightCurve();
				break;
			case 84: // 't' pressed, toggle the object table
				toggleObjectTable();
				break;
			case 80: // 'p' pressed, plot the object's positions
				plotPositions();
				break;

		}
	}

	function previousLightCurve() {
		if (selectedObject==null) return;
		prevID = selectedObject.id - 1;
		if (prevID<0) prevID = objectList.length - 1;
		selectedObject = getObjectByID(objectList, prevID);
		console.log(selectedObject);
		updateSelectedObject(selectedObject);
		selectionActive = true;
		redrawCanvas();
		async(drawChart, null); 	
	}
	
	function nextLightCurve() {
		if (selectedObject==null) return;
		nextID = selectedObject.id + 1;
		if (nextID< objectList.length) {
			selectedObject = getObjectByID(objectList, nextID);
		} else {
			selectedObject = getObjectByID(objectList, 0);
		}
		console.log(selectedObject);
		updateSelectedObject(selectedObject);
		selectionActive = true;
		redrawCanvas();
		async(drawChart, null); 	
	}
	
	function togglePlotActive(colour) {
		switch(colour) {
			case 'r':
				plotRed = !plotRed
				$('#plotred').prop("checked", plotRed);
				break;
			case 'g':
				plotGreen = !plotGreen
				$('#plotgreen').prop("checked", plotGreen);
				break;
			case 'b':
				plotBlue = !plotBlue
				$('#plotblue').prop("checked", plotBlue);
				break;
			}
			async(drawChart, null);
		}
		
		
	function toggleComparison() {
		comparisonActive = !comparisonActive;
		$('#usecomparison').prop("checked", comparisonActive);
		async(drawChart, null);
		async(drawComparisonChart, null);
	}
	
	function toggleNormalisation() {
		if (normaliseActive) {
			normaliseActive = false;
			if (selectedObject!=null) drawChart(selectedObject);
			
		} else {
			normaliseActive = true;
			if (selectedObject!=null) drawChart(selectedObject);
		}
		console.log("Switched normalise mode", selectedObject);
		$('#normalise').prop("checked", normaliseActive);

	}
	
	function toggleChartHelp() {
		// This switches on and off the chart help that floats next to the mouse cursor on the chart
		if (canvasHelpActive) {
			$("#CanvasHelp").html("");
			$('#CanvasHelp').css('visibility', 'hidden');
			canvasHelpActive = false;
		} else {
			$("#CanvasHelp").html(canvasHelpHTML);
			$('#CanvasHelp').css('visibility', 'visible');
			// Move the box to where the mouse is located
			$('#CanvasHelp').css('left', mousePositionAbsolute.x + 'px');
			$('#CanvasHelp').css('top', mousePositionAbsolute.y + 'px');
		
			canvasHelpActive = true;
		}
	}
	
	function toggleObjectTable() {
		if (objectTableActive) {
			objectTableActive = false;
			$('#ObjectTable').html("");
		} else {
			objectTableActive = true;
			$('#ObjectTable').html(objectTable(objectList));
		}
		$('#objecttable').prop("checked", objectTableActive);

	}
	
	function setSelectedObjectFromTextbox(newID) {
		id = parseInt(newID);
		console.log('id', id);
		console.log(objectList.length);
		if (id>0 && id<objectList.length) chooseObjectByID(id);
	}
	
	function chooseObjectByID(id) {
		selectedObject = getObjectByID(objectList, id);
		console.log(selectedObject);
		updateSelectedObject(selectedObject);
		selectionActive = true;
		redrawCanvas();
		async(drawChart, null); 	
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
		htmlString = objectTable(objectList);
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
			updateSelectedObject(selectedObject);
			selectionActive = true;
			redrawCanvas();
			async(drawChart, null); 
		}
	}
	
	function mouseMoved(evt) {
		var x = parseInt(evt.offsetX);
		var y = height - parseInt(evt.offsetY);
		if (isNaN(x)) {
			x = evt.layerX;
			y = height - evt.layerY;
		}
		
		mousePositionAbsolute = { x: evt.clientX, y: evt.clientY };
		//console.log(mousePositionAbsolute);
		
		windowY = height - y;
		
		cursorString = " (" + x + ", " + y + ")";
		currentObject = getObjectUnderMouseCursor(x, y);
		//if (currentObject!=null) cursorString+= " [" + currentObject.id + "]";
		$('#MouseLocation').text(cursorString);

		if (loadedWCS) {
			worldLocation = wcsSolutionRed.pixelToWorld(x, y);
			worldLocationString = "&alpha;:" + degToSexString(worldLocation.wx / 15);
			worldLocationString+= "<br/>&delta;:" + degToSexString(worldLocation.wy);
			$('#HoverText').css('height', '32px');
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
	
	function updateSelectedObject(object) {
		tableHTML = "<table class='statustable'>";
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

		tableHTML+= "<tr>";
		
		tableHTML+= "<td>ID: <input type='text' size='2' id='SelectedObjectID' value='" + selectedObject.id + "' onchange='setSelectedObjectFromTextbox(this.value)'><td>"
		tableHTML+= "</tr>";
		tableHTML+= "</table>";
		
		$('#selectedobject').html(tableHTML);
		
	}
	
	function updateComparisonTable() {
		// Updates the HTML in the table containing info about which objects we are using as comparisons
		tableHTML = "<table class='statustable'>";
		tableHTML+= "<tr><th>Red</th><th>Green</th><th>Blue</th></tr>";
		tableHTML+= "<tr>";
		for (var i in colours) {
			c = colours[i];
			id = comparisonObject[c];
			tableHTML+= "<td>";
			referenceObject = getObjectByID(objectList, id);
			if (id!=-1) {
				numFrames = referenceObject.photometry[c].length;
				tableHTML+= "ID: " + comparisonObject[c] + "<br/>" + numFrames;
			} else {
				tableHTML+= "none";
			}
			tableHTML+= "</td>";
		}
		tableHTML+= "</tr>";
		tableHTML+= "</table>";
		$('#comparisonobject').html(tableHTML);
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
		$('#baseimage_'+baseColour).prop("checked", true);
		loadPNG();
	}
	
	function loadPNG() {
		//load the image
		filename = runName + "_" + baseColour + ".png";
		if (runVersion!='primary') filename = runName + "_" + baseColour + "_" + runVersion + ".png";
		image = new Image();
		image.src = filename;
		console.log("Loading", filename);
		image.onload = redrawCanvas;
	}
	
	function toggleCircles() {
		console.log("toggling circles");
		if (!circles) {
			drawCircles();
			circles = true;
		} else {
			circles = false;
			redrawCanvas();
		}
		$('#circles').prop("checked", circles);
	}

	function toggleLabels() {
		if (!labels) {
			drawObjectLabels();
			labels = true;
		} else {
			labels = false;
			redrawCanvas();
		}
		$('#labels').prop("checked", labels);
	}
	
	function redrawCanvas() {
		clearCanvas();
		context.drawImage(image, 0, 0);
		if (circles) drawCircles();
		if (labels) drawObjectLabels();
		if (comparisonObject[baseColour]!=-1) drawSquare(getObjectByID(objectList, comparisonObject[baseColour]));
		if (selectionActive) drawDiamond(selectedObject);
	}	
	
	function updateComparison() {
		if (comparisonObject[baseColour]!=-1) {
			comparisonObject[baseColour]=-1;
			updateComparisonTable();
			redrawCanvas();
			drawComparisonChart();
			return;
		}
		if (selectedObject!=null) {
			comparisonObject[baseColour] = selectedObject.id;
			console.log("Updated comparison object", comparisonObject);
			updateComparisonTable();
			recomputeComparisonData(comparisonObject[baseColour], baseColour);
			selectionActive = false;
			selectedObject = null;
			redrawCanvas();
			drawComparisonChart();
		}
	}
	
	function recomputeComparisonData(objectID, colour) {
		// For all frames put the comparison data into the frame.. if the comparison has no data for a particular frame put in '-1'
		
		// Initialise the comparison data for this colour
		for (var i in frameList) {
			frameList[i].c[colour] = '-1';
		}
		// Now insert the photometry from the selected object
		object = getObjectByID(objectList, objectID);
		data = object.photometry[colour]
		for (var i in data) {
			measurement = data[i].magnitude;
			frameIndex = data[i].frameIndex;
			frameList[frameIndex-1].c[colour] = measurement;	
		}
	}	
	
	function drawSquare(object) {
		r = 15/1.414;
		meanPosition = object.meanPosition[baseColour];
		x = meanPosition[0];
		y = height - meanPosition[1];
		context.lineWidth = 2;
		context.strokeStyle = squareColour;
		context.beginPath();
		context.moveTo(x-r, y+r);
		context.lineTo(x+r ,y+r);
		context.lineTo(x+r, y-r);
		context.lineTo(x-r, y-r);
		context.closePath();
		context.stroke();
	}
			
	function drawDiamond(object) {
		r = 15;
		if (object.colourID[baseColour]!=-1) {
			meanPosition = object.meanPosition[baseColour];
			x = meanPosition[0];
			y = height - meanPosition[1];
			context.lineWidth = 2;
			context.strokeStyle = diamondColour;
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


	function exportToCSV(object) {
		if (object==null) object = selectedObject;
		if (object==null) {
			console.log("No object selected.... returning");
			return
		}
		console.log("Exporting the following object to CSV....");
		console.log(object);

		baseColours = [];
		if (plotRed) baseColours.push('r');
		if (plotGreen) baseColours.push('g');
		if (plotBlue) baseColours.push('b');

		var numColumns = 0;
		var coloursForChart = [];
		for (i in baseColours) {
			if (object.colourID[baseColours[i]]!=-1) {
				numColumns++;
				coloursForChart.push(baseColours[i]);
			}
		}
		
		console.log("Object has photometry for the following colours:", coloursForChart);

		headings = ["MJD"];
		for (i in coloursForChart) {
			headings.push(colourDescriptions[coloursForChart[i]]);
		}

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

		for (var i in coloursForChart) {
			colour = coloursForChart[i];
			data = object.photometry[colour];
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				//console.log(data[j]);
				frameIndex = parseInt(data[j].frameIndex);
				//console.log(" -- ", frameList[frameIndex-1].c[colour]);
				if (comparisonActive && comparisonObject[colour]!=-1) {
					comparisonReference = frameList[frameIndex-1].c[colour];
					if (comparisonReference!=-1) measurement = data[j].magnitude/comparisonReference;
					   else measurement = -1;
					}
				else { 
					measurement = data[j].magnitude; 
					}
				if (measurement!=-1) chartData[frameIndex][colourIndex] = measurement;
			}
		}
		
		if (normaliseActive) {
			for (var i in coloursForChart) {
			colour = coloursForChart[i];
			colourIndex = parseInt(i) + 1;
			min = 100000;
			max = 0;
			for (var j=1; j<chartData.length; j++) {
				value = chartData[j][colourIndex];
				if (value!=null) {
					//console.log(colour, value);
					if (value>max) max = value;
					if (value<min) min = value;
					}
				}
			//console.log("Max:", max);
			//console.log("Min:", min);
			range = max - min;
			
			for (var j=1; j<chartData.length; j++) {
				value = chartData[j][colourIndex];
				if (value!=null) {
					value = (value - min) / range;
					chartData[j][colourIndex] = value;
					//console.log(colour, value);
					
					}
				}
			}
		}
		
		// Clear out 'bad' data points from the chart data
		for (var i in chartData) {
			//console.log(chartData[i]);
			if (chartData[i][0]==51544) chartData.splice(i, 1);
		}
		for (var i in chartData) {
			//console.log(chartData[i]);
			if (chartData[i][0]==51544) chartData.splice(i, 1);
		}
		
	
	console.log(chartData);
	var csvContent = "data:text/csv;charset=utf-8,";
	
	chartData.forEach(function(infoArray, index){
		//console.log(infoArray);
		dataString = infoArray.join(",");
		csvContent+= dataString + "\n";
		//csvContent += index < infoArray.length ? dataString+ "\n" : dataString;
		});
	
	console.log(csvContent); 
	
	var encodedUri = encodeURI(csvContent);
    window.open(encodedUri);

	
	}


	function drawChart(object) {
		if (object==null) object = selectedObject;
		
		console.log("Drawing the chart of....");
		console.log(object);
		displayChartStatus("Drawing chart");
		
		baseColours = [];
		if (plotRed) baseColours.push('r');
		if (plotGreen) baseColours.push('g');
		if (plotBlue) baseColours.push('b');
		
		if (baseColours.length==0) {
			$('#main_chart_div').css('height', '0px');
			$('#main_chart_div').css('visibility', 'hidden');
			return;
		}
		
		var numColumns = 0;
		var coloursForChart = [];
		for (i in baseColours) {
			if (object.colourID[baseColours[i]]!=-1) {
				numColumns++;
				coloursForChart.push(baseColours[i]);
			}
		}
		
		console.log("Object has photometry for the following colours:", coloursForChart);
		
		headings = ["MJD"];
		for (i in coloursForChart) {
			headings.push(colourDescriptions[coloursForChart[i]]);
		}
		
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
				if (comparisonActive && comparisonObject[colour]!=-1) {
					comparisonReference = frameList[frameIndex-1].c[colour];
					if (comparisonReference!=-1) measurement = data[j].magnitude/comparisonReference;
					   else measurement = -1;
					}
				else { 
					measurement = data[j].magnitude; 
					}
				if (measurement!=-1) chartData[frameIndex][colourIndex] = measurement;
			}
		}
		
		if (normaliseActive) {
			for (var i in coloursForChart) {
			colour = coloursForChart[i];
			colourIndex = parseInt(i) + 1;
			min = 100000;
			max = 0;
			for (var j=1; j<chartData.length; j++) {
				value = chartData[j][colourIndex];
				if (value!=null) {
					//console.log(colour, value);
					if (value>max) max = value;
					if (value<min) min = value;
					}
				}
			//console.log("Max:", max);
			//console.log("Min:", min);
			range = max - min;
			
			for (var j=1; j<chartData.length; j++) {
				value = chartData[j][colourIndex];
				if (value!=null) {
					value = (value - min) / range;
					chartData[j][colourIndex] = value;
					//console.log(colour, value);
					
					}
				}
			}
		}
		
		// Clear out 'bad' data points from the chart data
		for (var i in chartData) {
			//console.log(chartData[i]);
			if (chartData[i][0]==51544) chartData.splice(i, 1);
		}
		for (var i in chartData) {
			//console.log(chartData[i]);
			if (chartData[i][0]==51544) chartData.splice(i, 1);
		}
	
		
		// Reveal the chart area...
		$('#main_chart_div').css('height', '400px');
		$('#main_chart_div').css('visibility', 'visible');
			
		
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

		console.log("Clearing the old chart");
		if (chart!=null) chart.clearChart();
        var chart = new google.visualization.ScatterChart(document.getElementById('main_chart_div'));
        google.visualization.events.addListener(chart, 'ready', chartReady);
        chart.draw(dataTable, options);
        
   		//chartData = [];
		//chartData.length = 0; 
		//chartColours = [];
		//chartColours.length = 0;
		//data.length = 0;
	}
	
	function chartReady() {
		clearChartStatus();
		console.log("Chart finished drawing");
	}
	
	function plotPositions() {
		console.log("Plotting the pixel... (x, y) positions");
		
		object = selectedObject;
		if (object==null) return;
		console.log(object);
		
		var numColours = 0;
		var coloursAvailable = [];
		
		for (i in colours) {
			var c = colours[i];
			
			if (object.colourID[c]!=-1) {
				numColours++;
				coloursAvailable.push(c);
			}
		}
		
		console.log("Pixel data exists for the following colours:", coloursAvailable);
		
		headings = ["MJD"];
		for (i in coloursAvailable) {
			headings.push(colourDescriptions[coloursAvailable[i]]);
		}
		
		
		chartData = [];
		chartData.length = 0; 
		
		chartData.push(headings);
		
		// Put the frame data into the data array
		for (var i in frameList) {
			MJD = frameList[i].MJD;
			temp = [ MJD ];
			for (var j in coloursAvailable) {
				temp.push(null);
			}
			chartData.push(temp);
		}
		
		var xmin = 1200;
		var xmax = 0;
		for (var i in coloursAvailable) {
			colour = coloursAvailable[i];
			var data = object.photometry[colour];
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				frameIndex = parseInt(data[j].frameIndex);
				x_pos = data[j].position[0]; 
				if (x_pos>xmax) xmax = x_pos;
				if (x_pos<xmin) xmin = x_pos;
				chartData[frameIndex][colourIndex] = x_pos;
			}
		}
		
		debug("Xmin, Xmax : " + xmin + ", " + xmax);
		
		
		// Reveal the chart area...
		$('#xpos_chart_div').css('height', '200px');
		$('#xpos_chart_div').css('visibility', 'visible');
	
		var dataTable = google.visualization.arrayToDataTable(chartData);

		var chartColours = [];
		for (var c in coloursAvailable) {
			chartColours.push(colourDescriptions[coloursAvailable[c]]);
		}

        var options = {
			title: 'X position of the Object: ' + object.id,
			colors: chartColours, 
			pointSize: 1, 
			explorer: { actions: ['dragToZoom', 'rightClickToReset'] } 
        	}

		console.log("Clearing the old chart");
		if (chartX!=null) chartX.clearChart();
        var chartX = new google.visualization.ScatterChart(document.getElementById('xpos_chart_div'));
        google.visualization.events.addListener(chartX, 'ready', chartReady);
        chartX.draw(dataTable, options);
        

		headings = ["MJD"];
		for (i in coloursAvailable) {
			headings.push(colourDescriptions[coloursAvailable[i]]);
		}
		
		
		chartData = [];
		chartData.length = 0; 
		
		chartData.push(headings);
		
		// Put the frame data into the data array
		for (var i in frameList) {
			MJD = frameList[i].MJD;
			temp = [ MJD ];
			for (var j in coloursAvailable) {
				temp.push(null);
			}
			chartData.push(temp);
		}
		
		var ymin = 1200;
		var ymax = 0;
		for (var i in coloursAvailable) {
			colour = coloursAvailable[i];
			var data = object.photometry[colour];
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				frameIndex = parseInt(data[j].frameIndex);
				y_pos = data[j].position[1]; 
				if (y_pos>ymax) ymax = y_pos;
				if (y_pos<ymin) ymin = y_pos;
				chartData[frameIndex][colourIndex] = y_pos;
			}
		}
		
		debug("Ymin, Ymax : " + ymin + ", " + ymax);
		
		// Reveal the chart area...
		$('#ypos_chart_div').css('height', '200px');
		$('#ypos_chart_div').css('visibility', 'visible');
	
		var dataTable = google.visualization.arrayToDataTable(chartData);

		var chartColours = [];
		for (var c in coloursAvailable) {
			chartColours.push(colourDescriptions[coloursAvailable[c]]);
		}

        var options = {
			title: 'Y position of the Object: ' + object.id,
			colors: chartColours, 
			pointSize: 1, 
			explorer: { actions: ['dragToZoom', 'rightClickToReset'] } 
        	}

		console.log("Clearing the old chart");
		if (chartY!=null) chartY.clearChart();
        var chartY = new google.visualization.ScatterChart(document.getElementById('ypos_chart_div'));
        google.visualization.events.addListener(chartY, 'ready', chartReady);
        chartY.draw(dataTable, options);

		
	}
	
	function drawComparisonChart() {
		console.log("Drawing the chart of the comparison....");
		
		var numColumns = 0;
		var coloursForChart = [];
		for (i in colours) {
			c = colours[i];
			if (comparisonObject[c]!=-1) {
				numColumns++;
				coloursForChart.push(c);
			}
		}
		
		console.log("Comparison photometry exists for the following colours:", coloursForChart);
		
		if ((coloursForChart.length==0) || !comparisonActive) {
			// No Comparison selected for any colour, hide the chart
			$('#comparison_chart_div').css('height', '0px');
			$('#comparison_chart_div').css('visibility', 'hidden');
			return;
		}

			
	
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
		
		
		for (var i in coloursForChart) {
			colour = coloursForChart[i];
			data = frameList;
			colourIndex = parseInt(i) + 1;
			for (var j=0; j< data.length; j++) {
				measurement = data[j].c[colour];
				if (measurement!=-1) chartData[j+1][colourIndex] = measurement;
			}
		}
		
		
		// Reveal the chart area...
		$('#comparison_chart_div').css('height', '400px');
		$('#comparison_chart_div').css('visibility', 'visible');
		
		var dataTable = google.visualization.arrayToDataTable(chartData);

		var chartColours = [];
		for (var c in coloursForChart) {
			chartColours.push(colourDescriptions[coloursForChart[c]]);
		}

        var options = {
			title: 'Comparison photometry',
			colors: chartColours, 
			pointSize: 1
        	}

        var chart = new google.visualization.ScatterChart(document.getElementById('comparison_chart_div'));
        google.visualization.events.addListener(chart, 'ready', chartReady);
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

