(function () {
  "use strict";

  adjustHeight();
  window.addEventListener("resize", adjustHeight);

  function adjustHeight() {
    const mapSize = document.querySelector("#map"),
      contentSize = document.querySelector("#content"),
      removeHeight = document.querySelector("#footer").offsetHeight,
      resize = window.innerHeight - removeHeight;

    mapSize.style.height = `${resize}px`;

    if (window.innerWidth >= 768) {
      contentSize.style.height = `${resize}px`;
      mapSize.style.height = `${resize}px`;
    } else {
      contentSize.style.height = `${resize * 0.25}px`;
      mapSize.style.height = `${resize * 0.75}px`;
    }
  }

  const button = document.querySelector("#legend button");
  button.addEventListener("click", function () {
    const legend = document.querySelector(".leaflet-legend");
    legend.classList.toggle("show-legend");
  });

  var map = L.map("map", {
    zoomSnap: 0.1,
    center: [-0.23, 37.8],
    zoom: 7,
    minZoom: 6,
    maxZoom: 9,
    maxBounds: L.latLngBounds([-6.22, 27.72], [5.76, 47.83]),
  });

  // mapbox API parameters
  const accessToken =
    "pk.eyJ1IjoiZ2VvZG9vZCIsImEiOiJjbHNqZ2F1dTEyNHZpMm5sZ2Rmb3lidzdqIn0.stqWHZNUSK7tQhQftnz6cQ";
  const mapboxName = "geodood";
  const myMapbox = "cm19v8jiv00hc01nw17sf2jst";

  // request a mapbox raster tile layer and add to map
  L.tileLayer(
    `https://api.mapbox.com/styles/v1/${mapboxName}/${myMapbox}/tiles/256/{z}/{x}/{y}?access_token=${accessToken}`,
    {
      attribution:
        'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, and <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
    }
  ).addTo(map);

  omnivore
    .csv("data/kenya_education_2014.csv")
    .on("ready", function (e) {
      drawMap(e.target.toGeoJSON());
      drawLegend(e.target.toGeoJSON());
    })
    .on("error", function (e) {
      console.log(e.error[0].message);
    });

  // calculate the radius for each point on the map
  function calcRadius(val) {
    const radius = Math.sqrt(val / Math.PI);
    return radius * 0.5; // adjust .5 as a scale factor
  }

  function getColor(x) {
    // Access the fourth stylesheet referenced in the HTML head element
    const stylesheet = document.styleSheets[3];
    const colors = [];

    // Check out the rules in the stylesheet
    console.log(stylesheet.cssRules);

    // Loop through the rules in the stylesheet
    for (let i of stylesheet.cssRules) {
      // When we find girls, add it's color to an array
      if (i.selectorText === ".girls") {
        colors[0] = i.style.backgroundColor;
      }
      if (i.selectorText === ".boys") {
        colors[1] = i.style.backgroundColor;
      }
    }

    // If function was given 'girls' return that color
    if (x == "girls") {
      return colors[0];
    } else {
      return colors[1];
    }
  }

  function drawMap(data) {
    const options = {
      pointToLayer: function (feature, ll) {
        return L.circleMarker(ll, {
          opacity: 1,
          weight: 2,
          fillOpacity: 0,
        });
      },
    };
    // create 2 separate layers from GeoJSON data
    const girlsLayer = L.geoJson(data, options).addTo(map),
      boysLayer = L.geoJson(data, options).addTo(map);

    // fit the bounds of the map to one of the layers
    map.fitBounds(girlsLayer.getBounds(), {
      padding: [50, 50],
    });

    girlsLayer.setStyle({
      color: getColor("girls"),
    });
    boysLayer.setStyle({
      color: getColor("boys"),
    });

    // call the resizeCircles function to start the thematic map
    resizeCircles(girlsLayer, boysLayer, 1);

    // call sequenceUI function
    sequenceUI(girlsLayer, boysLayer);
  } // end drawMap()

  // function to resize the circles each time the slider is changed/updated
  function resizeCircles(girlsLayer, boysLayer, currentGrade) {
    girlsLayer.eachLayer(function (layer) {
      const radius = calcRadius(
        Number(layer.feature.properties["G" + currentGrade])
      );
      layer.setRadius(radius);
    });
    boysLayer.eachLayer(function (layer) {
      const radius = calcRadius(
        Number(layer.feature.properties["B" + currentGrade])
      );
      layer.setRadius(radius);
    });

    // update the hover window with current grades
    retreiveInfo(boysLayer, currentGrade);
  }

  function sequenceUI(girlsLayer, boysLayer) {
    // sequenceUI function body
    // create Leaflet control for the slider
    const sliderControl = L.control({
      position: "bottomleft",
    });

    // when the slider is added...
    sliderControl.onAdd = function () {
      // select the current slider with an id of "slider"
      const controls = L.DomUtil.get("slider");

      // disable scroll / click events on the map beneath the slider
      L.DomEvent.disableScrollPropagation(controls);
      L.DomEvent.disableClickPropagation(controls);

      return controls;
    };
    // add control to the map
    sliderControl.addTo(map);

    // create leaflet control for the current grade output
    const gradeControl = L.control({
      position: "bottomleft",
    });

    gradeControl.onAdd = function () {
      const gradeDiv = L.DomUtil.get("grade");
      return gradeDiv;
    };
    // add gradeControl to the map
    gradeControl.addTo(map);

    //select the slider's input and listen for change
    const slider = document.querySelector("#slider input");
    //select the slider's input and listen for change
    slider.addEventListener("input", function (e) {
      // current value of slider is current grade level
      var currentGrade = e.target.value;

      // resize the circles with updated grade level
      resizeCircles(girlsLayer, boysLayer, currentGrade);
      // update grade display to match current slider value
      const gradeDisplay = document.querySelector("h5");
      gradeDisplay.textContent = `Grade: ${currentGrade}`;
    });
  }

  function drawLegend(data) {
    // create Leaflet control for the legend
    const legendControl = L.control({
      position: "bottomright",
    });

    legendControl.onAdd = function (map) {
      const legend = L.DomUtil.get("legend");

      L.DomEvent.disableScrollPropagation(legend);
      L.DomEvent.disableClickPropagation(legend);

      return legend;
    };
    legendControl.addTo(map);

    // empty array to hold values
    const dataValues = [];

    // loop through all features (i.e., the schools)
    data.features.forEach(function (school) {
      // for each grade in a school
      for (let grade in school.properties) {
        // shorthand to each value
        const value = school.properties[grade];
        // if the value can be converted to a number
        // the + operator in front of a number returns a number
        if (+value) {
          //return the value to the array
          dataValues.push(+value);
        }
      }
    });
    // verify your results!
    // console.log(dataValues);

    // sort our array
    const sortedValues = dataValues.sort(function (a, b) {
      return b - a;
    });

    // round the highest number and use as our large circle diameter
    const maxValue = Math.round(sortedValues[0] / 1000) * 1000;

    // calc the diameters
    const largeDiameter = calcRadius(maxValue) * 2,
      smallDiameter = largeDiameter / 2;

    // create a function with a short name to select elements
    const $ = function (x) {
      return document.querySelector(x);
    };

    // select our circles container and set the height
    $(".legend-circles").style.height = `${largeDiameter.toFixed()}px`;

    // set width and height for large circle
    $(".legend-large").style.width = `${largeDiameter.toFixed()}px`;
    $(".legend-large").style.height = `${largeDiameter.toFixed()}px`;

    // set width and height for small circle and position
    $(".legend-small").style.width = `${smallDiameter.toFixed()}px`;
    $(".legend-small").style.height = `${smallDiameter.toFixed()}px`;
    $(".legend-small").style.top = `${largeDiameter - smallDiameter - 2}px`;
    $(".legend-small").style.left = `${smallDiameter / 2}px`;

    // label the max and half values
    $(".legend-large-label").innerHTML = `${maxValue.toLocaleString()}`;
    $(".legend-small-label").innerHTML = (maxValue / 2).toLocaleString();

    // adjust the position of the large based on size of circle
    $(".legend-large-label").style.top = `${-11}px`;
    $(".legend-large-label").style.left = `${largeDiameter + 30}px`;

    // adjust the position of the large based on size of circle
    $(".legend-small-label").style.top = `${smallDiameter - 13}px`;
    $(".legend-small-label").style.left = `${largeDiameter + 30}px`;

    // insert a couple hr elements and use to connect value label to top of each circle
    $("hr.small").style.top = `${largeDiameter - smallDiameter - 10}px`;
  } // end drawLegend()

  function retreiveInfo(boysLayer, currentGrade) {
    // retreiveInfo funciton body here
    // goals: select the element adn reference with variable
    // since boysLayer is on top of girlsLayer, use it to detect mouseover events
    // this is why boysLayer is passed inside retreiveInfo and not girlsLayer, can test to show differences
    // remove the none class to display the element
    // derive the properties of the target layer
    // populate our info window HTML elements with the relevant information
    // change the appearance of the target circleMarker as an additional affordance
    // select the element and reference with variable
    const info = document.querySelector("#info");

    // since boysLayer is on top, use to detect mouseover events
    boysLayer.on("mouseover", function (e) {
      // replace the the display property with block and show
      info.style.display = "block";

      // access properties of target layer
      const props = e.layer.feature.properties;

      // create a function with a short name to select elements
      const $ = function (x) {
        return document.querySelector(x);
      };

      // populate HTML elements with relevant info
      $("#info span").innerHTML = props.COUNTY; // gets info specific to the county
      $(".girls span:first-child").innerHTML = `(grade ${currentGrade})`; // gets the girls info for that county
      $(".boys span:first-child").innerHTML = `(grade ${currentGrade})`; // gets the boys info for that county
      $(".girls span:last-child").innerHTML = Number(
        props[`G${currentGrade}`]
      ).toLocaleString();
      $(".boys span:last-child").innerHTML = Number(
        props[`B${currentGrade}`]
      ).toLocaleString();

      // raise opacity level as visual affordance
      e.layer.setStyle({
        fillOpacity: 0.6,
      });

      // hide the info panel when mousing off layergroup and remove affordance opacity
      boysLayer.on("mouseout", function (e) {
        // hide the info panel
        info.style.display = "none";

        // reset the layer style
        e.layer.setStyle({
          fillOpacity: 0,
        });
      });

      // empty arrays for boys and girls values
      const girlsValues = [],
        boysValues = [];

      // loop through the grade levels and push values into those arrays
      for (let i = 1; i <= 8; i++) {
        girlsValues.push(props["G" + i]);
        boysValues.push(props["B" + i]);
      }

      // define the styles for the girls D3 sparkline graph
      const girlsOptions = {
        id: "girlspark",
        width: 280, // No need for units; D3 will use pixels.
        height: 50,
        color: getColor("girls"),
        lineWidth: 3,
      };

      // define the styles for the girls D3 sparkline graph
      const boysOptions = {
        id: "boyspark",
        width: 280,
        height: 50,
        color: getColor("boys"),
        lineWidth: 3,
      };

      // add the sparkline to the map for each feature upon mouseover event
      sparkLine(girlsValues, girlsOptions, currentGrade);
      sparkLine(boysValues, boysOptions, currentGrade);
    });

    // when the mouse moves on the document
    document.addEventListener("mousemove", function (e) {
      // If the page is on the small screen, calculate the position of the info window
      if (window.innerWidth < 768) {
        info.style.right = "10px";
        info.style.top = `${window.innerHeight * 0.25 + 5}px`;
      } else {
        // Console the page coordinates to understand positioning
        console.log(e.pageX, e.pageY);

        // offset info window position from the mouse position
        (info.style.left = `${e.pageX + 6}px`),
          (info.style.top = `${e.pageY - info.offsetHeight - 25}px`);

        // if it crashes into the right, flip it to the left
        if (e.pageX + info.offsetWidth > window.innerWidth) {
          info.style.left = `${e.pageX - info.offsetWidth - 6}px`;
        }
        // if it crashes into the top, flip it lower right
        if (e.pageY - info.offsetHeight - 25 < 0) {
          info.style.top = `${e.pageY + 6}px`;
        }
      }
    });
  }

  function sparkLine(data, options, currentGrade) {
    // D3 uses SVG and data arrays to create sparkline
    // data: data array to be used for the sparkline. Index corresponds to the grade level,
    // the value at each index is the number of students in that grade
    // options: an object containing:
    // id: the ID of the element to which the sparkline will be appended
    // width: the width of the sparkline
    // height: the height of the sparkline
    // color: the color of the sparkline, which is dynamically set with our getColor function
    // lineWidth: the width of the sparkline.
    // currentGrade: the current grad elevel.
    d3.select(`#${options.id} svg`).remove();

    const w = options.width,
      h = options.height,
      m = {
        top: 5,
        right: 5,
        bottom: 5,
        left: 5,
      },
      iw = w - m.left - m.right,
      ih = h - m.top - m.bottom,
      x = d3.scaleLinear().domain([0, data.length]).range([0, iw]),
      y = d3
        .scaleLinear()
        .domain([d3.min(data), d3.max(data)])
        .range([ih, 0]);

    const svg = d3
      .select(`#${options.id}`)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    const line = d3
      .line()
      .x((d, i) => x(i))
      .y((d) => y(d));

    const area = d3
      .area()
      .x((d, i) => x(i))
      .y0(d3.min(data))
      .y1((d) => y(d));

    svg
      .append("path")
      .datum(data)
      .attr("stroke-width", 0)
      .attr("fill", options.color)
      .attr("opacity", 0.5)
      .attr("d", area);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", options.color)
      .attr("stroke-width", options.lineWidth)
      .attr("d", line);

    svg
      .append("circle")
      .attr("cx", x(Number(currentGrade) - 1))
      .attr("cy", y(data[Number(currentGrade) - 1]))
      .attr("r", "4px")
      .attr("fill", "white")
      .attr("stroke", options.color)
      .attr("stroke-width", options.lineWidth / 2);
  }
})();
