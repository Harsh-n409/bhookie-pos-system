import React, { useState } from "react";

const PaymentScreen = ({ amount, isEmployee, onComplete, onClose }) => {
  const [tenderedStr, setTenderedStr] = useState('');

  const tendered = parseFloat(tenderedStr || '0');
  const remainingAmount = Math.max(0, parseFloat((amount - tendered).toFixed(2)));
  const changeDue = Math.max(0, parseFloat((tendered - amount).toFixed(2)));

  const quickCashValues = [5, 10, 20, 50];

  // Handle number input including decimal and clear
  const handleNumberInput = (value) => {
    if (value === 'C') {
      setTenderedStr('');
    } else if (value === '⌫') {
      setTenderedStr(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!tenderedStr.includes('.')) {
        setTenderedStr(prev => prev + '.');
      }
    } else {
      setTenderedStr(prev => prev + value);
    }
  };

  // Final payment process
  const processPayment = (method) => {
    const exactAmount = parseFloat(amount.toFixed(2));
    const enteredAmount = parseFloat(tenderedStr || '0');

    if (isEmployee && enteredAmount.toFixed(2) !== exactAmount.toFixed(2)) {
      alert(`Employee must pay exactly £${exactAmount.toFixed(2)}`);
      return;
    }

    onComplete(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b">
          <h2 className="text-lg font-bold">
            Pay £{amount.toFixed(2)}
            {isEmployee && (
              <span className="block text-sm text-gray-500">
                (Exact amount required)
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>

        {/* Amount summary */}
        <div className="grid grid-cols-3 text-center p-3">
          <div>
            <div className="text-gray-500 text-xs">Tendered</div>
            <div className="text-lg font-semibold">£{tendered.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Remaining</div>
            <div className="text-lg font-semibold text-red-500">£{remainingAmount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Change</div>
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
                  return (current + value).toFixed(2);
                })}
                className="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-semibold"
              >
                £{value}
              </button>
            ))}

            {/* Cash Button */}
            <button
              onClick={() => processPayment("Cash")}
              className={`w-full p-2 ${
                "bg-green-500 hover:bg-green-600"
              } rounded-md text-white text-sm font-bold`}
              // disabled={isEmployee && tendered.toFixed(2) !== amount.toFixed(2)}
            >
              Cash
            </button>

            {/* Card Button */}
            <button
              onClick={() => processPayment("Card")}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white text-sm font-bold"
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
