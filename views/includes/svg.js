module.exports = function(options) {
  if (options.categoryName) {
    options.svgBasename = 'category-' + options.categoryName.toLowerCase().replace(/[^\w]+/g, '-');
  }

  let svg = require("fs").readFileSync(require("path").join(__dirname, '..', '..', 'static', 'icons', options.svgBasename + '.svg'), 'utf8');

  if (options.categoryName) {
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1><title>${options.categoryName}</title>`);
  }

  return svg;
}