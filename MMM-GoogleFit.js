"use strict";

function el(tag, options) {
  var result = document.createElement(tag);

  options = options || {};
  for (var key in options) {
    result[key] = options[key];
  }

  return result;
}

function prettyPrint(n) {
  return Number(n).toFixed(n < 10 ? 1 : 0) + "k";
}

Module.register("MMM-GoogleFit", {

  auth: undefined,
  code: undefined,
  error: undefined,
  defaults: {
    updateInterval: 30, // minutes
    stepGoal: 10000,
    startOnMonday: false,
    chartSize: 24, // px
    innerThickness: 0.8, // how much like a pie chart / doughnut, clamped in code
    fontSize: 18,
    stepCountLabel: false,
    useIcons: true,
    displayWeight: true,
    displayHeader: true,
    colors: [
      "#EEEEEE",
      "#1E88E5",
      "#9CCC65",
      "#5E35B1",
      "#FFB300",
      "#F4511E"
    ],
    debug: false
  },

  getScripts: function() {
    return [
      this.file("lib/highcharts.js")
    ];
  },

  start: function() {
    this.getStats();
    this.scheduleUpdate();
  },

  getDom: function() {
    var wrapper = el("stats", { className: "dimmed small" });

    if (this.config.displayHeader) {
      wrapper.appendChild(el("header", { innerHTML: "Google Fit" }));
    }

    if (this.stats) {
      var weights = [];
      var steps = [];
      var dates = [];
      var hasWeights = false;

      if (this.stats.bucket.length !== 7) {
        console.error("Google Fit data fetched does not match 7 days, layout might be incorrect. Data was trimmed.");
        this.stats.bucket = this.stats.bucket.slice(0, 7);
      }

      var numDays = this.stats.bucket.length; // should be 7?

      for (var i = 0; i < this.stats.bucket.length; i++) {
        var bucket = this.stats.bucket[i];

        dates.push(new Date(parseFloat(bucket.startTimeMillis)).toLocaleDateString());

        for (var j = 0; j < bucket.dataset.length; j++) {
          var data = bucket.dataset[j];

          var weight = false;
          var step = false;

          if (data.dataSourceId.indexOf("weight") != -1) {
            weight = true;
          } else if (data.dataSourceId.indexOf("step_count") != -1) {
            step = true;
          }

          var total = 0;
          for (var k = 0; k < data.point.length; k++) {
            var point = data.point[k];

            var tmp = 0;
            for (var l = 0; l < point.value.length; l++) {
              if (point.value[l].intVal) {
                tmp += point.value[l].intVal;
              } else if (point.value[l].fpVal) {
                tmp += point.value[l].fpVal;
              }
            }

            if (weight && point.value.length > 0) {
              // Average weights
              tmp /= point.value.length;
            }

            total += tmp;
          }

          if (weight) {
            if (data.point.length > 0) {
              total /= data.point.length;

              if (config.units === "imperial") {
                total *= 2.20462;
              }

              total = total.toFixed(0);
            } else {
              total = undefined;
            }

            weights.push(total);
          } else if (step) {
            steps.push(total);
          }
        }
      }

      if (this.config.debug) {
        console.log(weights);
        console.log(steps);
        console.log(dates);
      }

      var chartSize = this.config.chartSize;
      var totalSize = chartSize * 1.1;
      var thickness = Math.min(Math.max(this.config.innerThickness, 0), 1) * 100;
      var colors = this.config.colors;
      //var table = el("table", { style: "width: auto" });
      var table = el("table");
      var row = el("tr");
      var cell;

      // Add in walking icon
      if (this.config.useIcons) {
        row.appendChild(el("td").appendChild(el("img", { src: this.file("icons/icons8-walking-20.png") })).parentElement);
      }

      for (var i = 0; i < steps.length; i++) {
        var percent = steps[i] / this.config.stepGoal;
        var colorOffset = Math.floor(percent) % colors.length;

        cell = el("td", { style: "padding-left: 5px; padding-right: 5px;" });

        // 5x more than the desired step count is the last color (red) and will stay that way
        if (percent > colors.length - 1) {
          var data = [{
            color: colors[colors.length - 1],
            y: 1,
          }];
        } else {
          percent -= Math.floor(percent);

          var data = [{
            color: colors[colorOffset + 1],
            y: percent,
          },
          {
            color: colors[colorOffset],
            y: 1 - percent
          }];
        }

        // Create chart canvas
        var chart = el("div", { id: "google-fit-chart-" + i, style: "width: " + totalSize + "px; margin-left: auto; margin-right: auto" });

        Highcharts.chart(chart, {
          title: {
            text: null
          },
          chart: {
            width: totalSize,
            height: totalSize,
            backgroundColor: null,
            plotShadow: false,
            margin: 0
          },
          plotOptions: {
            pie: {
              dataLabels: {
                enabled: false
              }
            }
          },
          series: [{
            type: "pie",
            innerSize: thickness + "%",
            data: data,
            size: chartSize,
            center: ["50%", "50%"],
            borderColor: null,
          }],
          credits: {
            enabled: false
          },
        });

        // Append chart
        cell.appendChild(chart);
        row.appendChild(cell);
      }

      table.appendChild(row);

      var days = ["S", "M", "T", "W", "T", "F", "S"];
      if (this.config.startOnMonday) {
        days.push(days.shift());
      }

      row = el("tr");
      if (this.config.useIcons) {
        row.appendChild(el("td"));
      }
      for (var i = 0; i < days.length; ++i) {
        row.appendChild(el("td", { innerHTML: days[i], style: "text-align: center" }));
      }
      table.appendChild(row);

      if (this.config.stepCountLabel) {
        row = el("tr");
        if (this.config.useIcons) {
          row.appendChild(el("td"));
        }
        for (var i = 0; i < steps.length; ++i) {
          row.appendChild(el("td", { innerHTML: (steps[i] > 0) ? prettyPrint(steps[i] * 0.001) : "", style: "text-align: center" }));
        }
        table.appendChild(row);
      }

      if (weights.some(w => w > 0)) {
        row = el("tr");
        if (this.config.useIcons) {
          row.appendChild(el("td").appendChild(el("img", { src: this.file("icons/icons8-scale-20.png") })).parentElement);
        }
        for (var i = 0; i < numDays; i++) {
          row.appendChild(el("td", { innerHTML: (weights[i] > 0) ? weights[i] : "", style: "text-align: center" }));
        }
        table.appendChild(row);
      }

      wrapper.appendChild(table);
    } else if (this.auth) {
      wrapper.appendChild(el("span", { innerHTML: "Authenticated, Loading Data..." }));
    } else if (this.code) {
      wrapper.appendChild(el("span", { innerHTML: "Please Visit: " + this.code.verification_url + "<br>" + "Code: " + this.code.user_code }));
    } else if (this.error) {
      wrapper.appendChild(el("span", { innerHTML: "Error Getting Auth<br>" + this.error }));
    }

    return wrapper;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval * 60 * 1000;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setInterval(function() {
      self.getStats();
    }, nextLoad);
  },

  getStats: function () {
    this.sendSocketNotification("UPDATE", this.config);
  },

  capitalize: function (s) {
    s = s.replace(/_/g, " ");
    return s.toLowerCase().replace(/\b./g, function (a) { return a.toUpperCase(); });
  },

  socketNotificationReceived: function(notification, result) {
    if (notification === "AUTH_CODE_BODY") {
      this.code = result;
      if (this.config.debug) {
        console.log("user code: " + result.user_code);
      }
    } else if (notification === "REFRESH_TOKEN_BODY") {
      this.auth = result;
    } else if (notification === "STATS") {
      this.stats = result;
    }

    if (notification.toLowerCase().indexOf("error") !== -1) {
      this.auth = undefined;
      this.stats = undefined;

      this.error = this.capitalize(notification);
    }

    if (this.config.debug) {
      console.log(notification);
      console.log(result);
    }

    this.updateDom(500);
  },

});
