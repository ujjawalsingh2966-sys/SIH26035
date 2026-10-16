// Measure the painted CSS background through transparent ancestors. Gradients are
// reported explicitly: a base-color ratio over a gradient is only an estimate.
async function textContrast(locator, placeholder = false) {
  return locator.evaluate((element, placeholder) => {
    const rgba = value => {
      const parts = value.match(/[\d.]+/g)?.map(Number) || [];
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] ?? 1];
    };
    const blend = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0, 3).map((channel, i) => alpha ? (channel * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0), alpha];
    };
    const layers = [], gradients = [];
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      if (style.backgroundImage !== 'none') gradients.push({ tag: node.tagName, className: node.className, image: style.backgroundImage });
      const color = rgba(style.backgroundColor);
      layers.push({ tag: node.tagName, className: node.className, color: style.backgroundColor });
      if (color[3] === 1) break;
    }
    let background = [255, 255, 255, 1];
    for (const layer of layers.slice().reverse()) background = blend(rgba(layer.color), background);
    const style = getComputedStyle(element, placeholder ? '::placeholder' : null);
    const foreground = rgba(style.color);
    foreground[3] *= Number(style.opacity) * (placeholder ? opacity : 1);
    const paintedText = blend(foreground, background);
    const luminance = color => {
      const linear = color.slice(0, 3).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const levels = [luminance(paintedText), luminance(background)].sort((a, b) => b - a);
    return {
      text: placeholder ? element.getAttribute('placeholder') : element.textContent?.trim() || element.getAttribute('placeholder'),
      foreground: style.color, background: background.slice(0, 3).map(Math.round),
      contrast: (levels[0] + 0.05) / (levels[1] + 0.05),
      approximate: gradients.length > 0, gradients, layers,
      opacity, outline: getComputedStyle(element).outline, boxShadow: getComputedStyle(element).boxShadow,
      colorScheme: getComputedStyle(element).colorScheme,
    };
  }, placeholder);
}

module.exports = { textContrast };
