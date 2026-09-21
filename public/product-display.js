// Temporary presentation alias. Never use this helper for stored values or API payloads.
(function (root) {
  function displayProductText(value) {
    return String(value == null ? '' : value)
      .replace(/\bastro[\s-]*rekha(?:\s+(?:ind|india))?\b/gi, 'AR');
  }
  function readProductDisplayInput(input) {
    if (!input) return '';
    var original = input.getAttribute('data-product-original');
    return original != null && input.value === displayProductText(original) ? original : input.value;
  }
  if (typeof module === 'object' && module.exports) module.exports = { displayProductText: displayProductText, readProductDisplayInput: readProductDisplayInput };
  else {
    root.displayProductText = displayProductText;
    root.readProductDisplayInput = readProductDisplayInput;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
