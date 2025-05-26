import React, { useState, useEffect, useCallback } from "react";

const PaymentScreen = ({ amount, isEmployee, onComplete, onClose }) => {
  const [tenderedStr, setTenderedStr] = useState('');
  const [paidAmounts, setPaidAmounts] = useState([]);
  const [remainingAmount, setRemainingAmount] = useState(amount);
  const [activeMethod, setActiveMethod] = useState(null);

  // Reset remaining amount and clear previous payments/input when the total bill amount changes (e.g., new order)
  useEffect(() => {
    setRemainingAmount(amount);
    setPaidAmounts([]); // Also clear previous payments if bill changes
    setTenderedStr(''); // Clear tendered string
  }, [amount]);

  // Derive tendered amount from input string for display and calculations
  const tendered = parseFloat(tenderedStr || '0');
  // Change due is calculated based on the current input vs. the remaining bill
  const changeDue = Math.max(0, parseFloat((tendered - remainingAmount).toFixed(2)));

  const quickCashValues = [5, 10, 20, 50];

  // Handle number input including decimal, backspace, and clear
  const handleNumberInput = (value) => {
    if (value === 'C') {
      setTenderedStr('');
    } else if (value === '⌫') {
      setTenderedStr(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!tenderedStr.includes('.')) {
        setTenderedStr(prev => prev + '.');
      }
    } else if (value === '00') {
      // Allow '00' only if it doesn't lead to "00", "00." etc.
      if (tenderedStr === '' || tenderedStr === '0') {
        setTenderedStr('0'); // Still '0'
      } else {
        setTenderedStr(prev => prev + value);
      }
    } else {
      // Prevent leading zeros unless it's a decimal, e.g., "0.5" is okay, "01" is not
      if (tenderedStr === '0' && value !== '.') {
        setTenderedStr(value); // Replace '0' with the new digit
      } else {
        // Prevent entering more than 2 decimal places
        if (tenderedStr.includes('.') && tenderedStr.split('.')[1].length >= 2) {
          return;
        }
        setTenderedStr(prev => prev + value);
      }
    }
  };

  // Unified payment processing function
  const processPayment = useCallback((method) => {
    let paymentAmount = tendered; // Start with what's entered in the input field

    // --- Input Validation ---
    if (paymentAmount <= 0 && method !== "Card") { // Card button passes remaining, so 0 is fine if remaining is 0
      alert("Please enter a valid amount.");
      return;
    }
    if (remainingAmount <= 0) {
      alert("The bill has already been fully paid.");
      onClose(); // Close the screen if already paid
      return;
    }

    // --- Employee Specific Rule ---
    // Employee must pay exactly the remaining amount, regardless of method
    if (isEmployee) {
      if (paymentAmount.toFixed(2) !== remainingAmount.toFixed(2)) {
        alert(`Employee must pay exactly £${remainingAmount.toFixed(2)}.`);
        return;
      }
      // If employee, force paymentAmount to remainingAmount (even if tenderedStr was more for cash)
      paymentAmount = remainingAmount;
    }

    // --- Method-Specific Logic ---
    let amountToApplyToBill; // This is the amount that reduces the bill
    let actualTenderedForRecord; // This is what the customer gave (for cash) or what was charged (for card)
    let currentChangeDue = 0;

    if (method === "Cash") {
      // Cash: Allow overpayment.
      // If tendered is less than remaining, it's a partial cash payment.
      if (paymentAmount < remainingAmount) {
        amountToApplyToBill = paymentAmount; // Apply the partial amount
        actualTenderedForRecord = paymentAmount; // Record what they gave for this partial
        currentChangeDue = 0; // No change on partial cash payment
      } else {
        // Tendered amount is equal to or more than remaining bill
        amountToApplyToBill = remainingAmount; // Only apply the remaining bill amount
        actualTenderedForRecord = paymentAmount; // Record what they actually gave
        currentChangeDue = parseFloat((paymentAmount - remainingAmount).toFixed(2));
      }
    } else if (method === "Card") {
      // Card: Must be exact remaining amount
      // If the input field has an amount, we could validate it,
      // but the button click for Card should implicitly mean paying the *remaining* amount.
      if (paymentAmount > 0 && paymentAmount.toFixed(2) !== remainingAmount.toFixed(2)) {
         alert(`For Card payments, please enter the exact remaining amount: £${remainingAmount.toFixed(2)}. Or just click 'Card' to pay the exact amount.`);
         return;
      }
      amountToApplyToBill = remainingAmount; // Card always pays the exact remaining
      actualTenderedForRecord = remainingAmount; // Record the exact amount charged
      currentChangeDue = 0; // No change for card payments
    } else {
      // Other payment methods (e.g., UPI, etc. if you add them later)
      // By default, assume they should pay exactly the remaining amount
      if (paymentAmount.toFixed(2) !== remainingAmount.toFixed(2)) {
         alert(`Amount tendered (£${paymentAmount.toFixed(2)}) must be exactly the remaining bill (£${remainingAmount.toFixed(2)}) for ${method}.`);
         return;
      }
      amountToApplyToBill = remainingAmount;
      actualTenderedForRecord = paymentAmount;
      currentChangeDue = 0;
    }

    // --- Update State ---
    const newRemaining = parseFloat((remainingAmount - amountToApplyToBill).toFixed(2));
    
    // Store the payment details, including what was *tendered* for cash
    setPaidAmounts(prev => [...prev, {
      amount: amountToApplyToBill,
      method: method,
      tenderedAmount: actualTenderedForRecord, // Store what customer gave (important for cash change calculation on KOT)
      change: currentChangeDue // Store change for this specific payment (will be 0 for partials/cards)
    }]);
    
    setRemainingAmount(newRemaining);
    setTenderedStr(''); // Clear input for next potential partial payment
    setActiveMethod(null);

    // --- Complete Transaction ---
    if (newRemaining <= 0) {
      setTimeout(() => {
        // Ensure to calculate the *final* change across all payments
        // This is primarily for the last cash payment if it resulted in change.
        const totalChangeAcrossPayments = paidAmounts.reduce((acc, p) => acc + p.change, 0) + currentChangeDue;

        onComplete({
          totalBillAmount: amount, // The original total bill
          finalChangeDue: totalChangeAcrossPayments,
          payments: [...paidAmounts, { // Pass all recorded payments
            amount: amountToApplyToBill,
            method: method,
            tenderedAmount: actualTenderedForRecord,
            change: currentChangeDue
          }]
        });
        onClose();
      }, 500); // Small delay for visual feedback
    }
  }, [tendered, remainingAmount, amount, paidAmounts, isEmployee, onComplete, onClose]); // Dependencies for useCallback


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b">
          <h2 className="text-lg font-bold">
            Pay £{amount.toFixed(2)}
            {isEmployee && (
              <span className="block text-sm text-gray-500">
                (Employee: Exact amount required)
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>

        {/* Payment summary - Only show if partial payments exist */}
        {paidAmounts.length > 0 && (
          <div className="p-3 space-y-2 border-b">
            {paidAmounts.map((payment, index) => (
              <div key={index} className="text-sm">
                £{payment.amount.toFixed(2)} paid by {payment.method}
                {payment.method === "Cash" && payment.change > 0 && (
                    <span className="ml-2 text-green-600"> (Change: £{payment.change.toFixed(2)})</span>
                )}
              </div>
            ))}
            {remainingAmount > 0 && (
              <div className="text-lg font-semibold text-red-500">
                Remaining to Pay: £{remainingAmount.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Amount summary */}
        <div className="grid grid-cols-3 text-center p-3">
          <div>
            <div className="text-gray-500 text-xs">Tendered</div>
            <div className="text-lg font-semibold">£{tendered.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Remaining Bill</div>
            {/* Display the actual remaining amount of the bill */}
            <div className="text-lg font-semibold">
              £{remainingAmount.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Change Due (Current Input)</div>
            {/* This changeDue is based on the current 'tendered' input and 'remainingAmount' */}
            <div className="text-lg font-semibold">£{changeDue.toFixed(2)}</div>
          </div>
        </div>

        {/* Input section */}
        <div className="flex">
          {/* Number Pad */}
          <div className="w-2/3 grid grid-cols-3 gap-1 p-2">
            {[
              '1', '2', '3',
              '4', '5', '6',
              '7', '8', '9',
              '.', '0', '00',
              '⌫', 'C'
            ].map((key) => (
              <button
                key={key}
                onClick={() => handleNumberInput(key)}
                className={`p-2 rounded-md text-xl font-bold ${
                  key === 'C' ? 'bg-red-500 text-white' :
                  key === '.' ? 'bg-gray-300' :
                  key === '⌫' ? 'bg-yellow-400 text-black' :
                  'bg-gray-100'
                } hover:bg-gray-200`}
                disabled={key === '.' && tenderedStr.includes('.')}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Quick cash + Pay buttons */}
          <div className="w-1/3 p-2 space-y-1">
            {quickCashValues.map((value) => (
              <button
                key={value}
                onClick={() => setTenderedStr(prev => {
                  const current = parseFloat(prev || '0');
                  // Ensure adding quick cash works correctly with floating point
                  return (current + value).toFixed(2);
                })}
                className="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-semibold"
                // Disable quick cash if already fully paid and it's not a cash input to make change
                disabled={remainingAmount <= 0 && tendered >= remainingAmount}
              >
                £{value}
              </button>
            ))}

            {/* Cash Button */}
            <button
              onClick={() => processPayment("Cash")}
              className={`w-full p-2 ${
                activeMethod === "Cash" ? "bg-green-600" : "bg-green-500 hover:bg-green-600"
              } rounded-md text-white text-sm font-bold`}
              disabled={remainingAmount <= 0} // Disable if bill is fully paid
            >
              Cash
            </button>

            {/* Card Button */}
            <button
              onClick={() => {
                // For Card, ensure the input field is set to the exact remaining amount before processing.
                // This makes the validation inside processPayment more robust.
                setTenderedStr(remainingAmount.toFixed(2));
                setActiveMethod("Card");
                processPayment("Card");
              }}
              className={`w-full p-2 ${
                activeMethod === "Card" ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600"
              } rounded-md text-white text-sm font-bold`}
              disabled={remainingAmount <= 0} // Disable if bill is fully paid
            >
              Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;