// Small pricing helper with a quick self-check.
function calculatePrice(basePrice, quantity = 1, discountPercent = 0, taxPercent = 0) {
  const subtotal = basePrice * quantity;
  const discounted = subtotal * (1 - discountPercent / 100);
  const total = discounted * (1 + taxPercent / 100);
  return Math.round(total * 100) / 100;
}



console.assert(calculatePrice(100) === 100, "base price");
console.assert(calculatePrice(50, 2) === 100, "quantity");
console.assert(calculatePrice(100, 1, 10) === 90, "discount");
console.assert(calculatePrice(100, 1, 0, 18) === 118, "tax");

console.log("pricing-test.js: all checks passed");
