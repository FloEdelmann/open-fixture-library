#!/usr/bin/node

const register = require(`../fixtures/register.json`);
const model = require(`../lib/model.js`);

const D3Node = require(`d3-node`);
const { writeFileSync } = require(`fs`);


const data = Object.keys(register.filesystem).map(key => {
  const [manKey, fixKey] = key.split(`/`);
  const fixture = model.fixtureFromRepository(manKey, fixKey);

  let date = fixture.meta.createDate;

  if (fixture.meta.importDate && fixture.meta.importDate > date) {
    date = fixture.meta.importDate;
  }

  return { date };
});

data.sort((a, b) => a.date - b.date);

data.forEach((elem, index) => {
  elem.numFixtures = index + 1;
});


const margin = { top: 20, right: 20, bottom: 30, left: 50 };
const width = 800;
const height = 500;
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const d3n = new D3Node({
  styles: `
    .axis path,
    .axis line,
    .legend rect {
      fill: none;
      stroke: #ccc;
      stroke-width: 1px;
    }

    /* hide the zero tick mark */
    .y-axis .tick:first-of-type text {
      opacity: 0;
    }

    /* highlight January tick marks */
    .x-axis .tick:not(:nth-of-type(12n+1)) text {
      opacity: 0.5;
    }

    /* hide every second month tick mark */
    .x-axis .tick:nth-of-type(2n) text {
      opacity: 0;
    }

    .num-fixtures {
      fill: none;
      stroke: #2196f3;
      stroke-width: 2px;
    }

    .legend rect {
      fill: #fff;
    }
  `,
});
const d3 = d3n.d3;

const svg = d3n.createSVG(width, height)
  .append(`g`)
  .attr(`transform`, `translate(${margin.left}, ${margin.top})`);

const xAxis = d3.scaleTime()
  .range([0, innerWidth])
  .domain([new Date(2017, 0, 1), d3.max(data, d => d.date)]);

const yAxis = d3.scaleLinear()
  .range([innerHeight, 0])
  .domain([0, d3.max(data, d => d.numFixtures)]);

const valueline = d3.line()
  .x(d => xAxis(d.date))
  .y(d => yAxis(d.numFixtures));

svg.append(`g`)
  .attr(`class`, `axis x-axis`)
  .attr(`transform`, `translate(0, ${innerHeight})`)
  .call(d3.axisBottom(xAxis)
    .ticks(d3.timeMonth.every(1))
    .tickFormat(d3.timeFormat(`%m/%y`))
    .tickSizeInner(-innerHeight)
    .tickSizeOuter(0),
  );

svg.append(`g`)
  .attr(`class`, `axis y-axis`)
  .call(d3.axisLeft(yAxis)
    .tickSizeInner(-innerWidth)
    .tickSizeOuter(0),
  );

svg.append(`path`)
  .data([data])
  .attr(`class`, `num-fixtures`)
  .attr(`d`, valueline);


const legend = svg.append(`g`)
  .attr(`class`, `legend`)
  .attr(`transform`, `translate(20, 20)`);

legend.append(`rect`)
  .attr(`x`, -10)
  .attr(`y`, -14)
  .attr(`width`, 240)
  .attr(`height`, 45);

legend.append(`path`)
  .attr(`class`, `num-fixtures`)
  .attr(`d`, `M 0,0 H 20`);

legend.append(`text`)
  .attr(`x`, 30)
  .attr(`y`, 0)
  .text(`Number of fixtures in OFL: ${data.length}`)
  .style(`font-size`, `14px`)
  .attr(`alignment-baseline`, `middle`);

const lastUpdated = d3.timeFormat(`%Y-%m-%d`)(new Date());
legend.append(`text`)
  .attr(`x`, 30)
  .attr(`y`, 20)
  .text(`Last updated: ${lastUpdated}`)
  .style(`font-size`, `12px`)
  .attr(`alignment-baseline`, `middle`);


writeFileSync(`fixture-graph.svg`, d3n.svgString(), `utf8`);
