import { useEffect, useState, useMemo } from "react";
import {
  collection,
  updateDoc,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  where,
  query,
} from "firebase/firestore";
import { db } from "../firebase/config";



export default function MenuGrid({
  onAddItem = () => {},
  onApplyOffer = () => {},
  appliedOffers,
}) {
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState([]);
  const [selectedForUpgrade, setSelectedForUpgrade] = useState(null);
  const [showCustomizationPopup, setShowCustomizationPopup] = useState(false);
  const [customizationOptions, setCustomizationOptions] = useState([]);
  const [nextCustomization, setNextCustomization] = useState(null);
  const [customizationStep, setCustomizationStep] = useState(0); 
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [error, setError] = useState(null);
  const [sauceOptions, setSauces] = useState([]);
  const [showSaucePopup, setShowSaucePopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showOffers, setShowOffers] = useState(true);
  const [offers, setOffers] = useState([]);


  // Clickable items - lowercased for comparison
  const clickableItems = [
    "chicken drumsticks",
    "manchurian bites",
    "vada pav",
    "bhaji pav",
    "veggie aloo tikki burger",
    "chai",
    "chicken spicy burger + chicken drumstick",
  ];

  const ELIGIBLE_BASE_ITEMS = [
  "Classic Fries (Regular)",
  "Cheesy Fries (Regular)",
  "Noodle Bhel (Regular)", 
  "Signature Fries"
];

const ELIGIBLE_MEAL_KEYWORDS = [
  "Classic Fries",
  "Cheesy Fries",
  "Noodle Bhel",
  "Signature Fries"
];
  // Sample offers data
  // const offers = [
  //   {
  //     id: "offer1",
  //     title: "COMBO DEAL",
  //     description: "Chicken Spicy Burger + Drumstick",
  //     price: "£7.99",
  //     originalPrice: "£9.50",
  //     items: ["chicken spicy burger", "chicken drumsticks"],
  //     color: "bg-gradient-to-r from-red-600 to-orange-500"
  //   },
  //   {
  //     id: "offer2",
  //     title: "VEGGIE SPECIAL",
  //     description: "Vada Pav + Bhaji Pav",
  //     price: "£6.50",
  //     originalPrice: "£8.00",
  //     items: ["vada pav", "bhaji pav"],
  //     color: "bg-gradient-to-r from-green-600 to-emerald-500"
  //   },
  //   {
  //     id: "offer3",
  //     title: "SNACKS COMBO",
  //     description: "Chicken Bites + Manchurian Bites",
  //     price: "£5.99",
  //     originalPrice: "£7.50",
  //     items: ["chicken bites", "manchurian bites"],
  //     color: "bg-gradient-to-r from-purple-600 to-indigo-500"
  //   },
  //   {
  //     id: "offer4",
  //     title: "QUICK MEAL",
  //     description: "Veggie Burger + Chai",
  //     price: "£4.99",
  //     originalPrice: "£6.50",
  //     items: ["vada pav", "chai"],
  //     color: "bg-gradient-to-r from-blue-600 to-cyan-500"
  //   }
  // ];





  useEffect(() => {
    const fetchData = async () => {
      try {
        const categorySnap = await getDocs(
          query(collection(db, "category"), where("active", "==", true))
        );
        const categoryData = categorySnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Add new "meals" category with a temporary unique id
        const updatedCategories = categoryData;
        setCategories(updatedCategories);

        const offersSnap = await getDocs(
          query(collection(db, "Offers"), where("active", "==", true))
        );

        const offersData = await Promise.all(
          offersSnap.docs.map(async (offerDoc) => {
            const data = offerDoc.data();
            const items = await Promise.all(
              data.items.map(async (itemRef) => {
                // Handle string paths or references
                if (typeof itemRef === "string") {
                  const [collectionName, itemId] = itemRef.split("/");
                  const correctedCollection = collectionName.toLowerCase();
                  const itemDocRef = doc(db, correctedCollection, itemId);
                  const itemSnap = await getDoc(itemDocRef);
                  return itemSnap.exists()
                    ? { id: itemSnap.id, ...itemSnap.data() }
                    : null;
                } else {
                  const itemSnap = await getDoc(itemRef);
                  return itemSnap.exists()
                    ? { id: itemSnap.id, ...itemSnap.data() }
                    : null;
                }
              })
            );
            return {
              id: offerDoc.id,
              ...data,
              items: items.filter(Boolean),
              originalPrice: items.reduce(
                (sum, item) => sum + (item?.price || 0),
                0
              ),
            };
          })
        );
        setOffers(offersData.filter((offer) => offer.items.length > 0));

        const itemsSnap = await getDocs(
          query(collection(db, "items"), where("active", "==", true))
        );
        const itemData = itemsSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            categoryId:
              data.categoryId?.id || data.categoryId?.split("/").pop() || null,
          };
        });

        // Add new meal items with categoryId set to mealsCategory.id
        // const newMealItems = [
        //   { id: "meal1", itemName: "Meals (Burger + Classic Fries + Soda Cans)", price: 7.49, categoryId: mealsCategory.id },
        //   { id: "meal2", itemName: "Meals (Spicy Burger + Classic Fries + Soda Cans)", price: 7.99, categoryId: mealsCategory.id },
        //   { id: "meal3", itemName: "Box Meals (Burger + Classic Fries + Soda Cans + Any Bites + Gravy)", price: 9.99, categoryId: mealsCategory.id },
        //   { id: "meal4", itemName: "Box Meals (Spicy Burger + Classic Fries + Soda Cans + Any Bites + Gravy)", price: 10.49, categoryId: mealsCategory.id },
        //   { id: "upgrade1", itemName: "Upgrade to Large", price: 0.69, categoryId: mealsCategory.id },
        //   { id: "upgrade2", itemName: "Upgrade to Cheesy fries", price: 0.69, categoryId: mealsCategory.id },
        //   { id: "upgrade3", itemName: "Upgrade to Noodle Bhel", price: 1.49, categoryId: mealsCategory.id },
        // ];

        // const updatedItems = [...itemData, ...newMealItems];
        setItems(itemData);

        // Set up real-time inventory listeners for each item
        itemData.forEach((item) => {
          const inventoryRef = doc(db, "inventory", item.id);
          const unsubscribe = onSnapshot(inventoryRef, (doc) => {
            setInventory((prev) => ({
              ...prev,
              [item.id]: doc.exists() ? doc.data() : { totalStockOnHand: 9999 },
            }));
          });

          // Return cleanup function for the effect
          return () => unsubscribe();
        });
      } catch (err) {
        setError("Error loading menu data");
        console.error("Error loading menu data:", err);
      }
    };

    fetchData();
  }, []);

  
  const filteredItems = useMemo(() => {
    return items.filter((item) => item.categoryId === selectedCategoryId);
  }, [items, selectedCategoryId]);

  
  

const handleItemClick = async (item) => {
  setSelectedItem(item);
  setNextCustomization(null); // reset

  try {
    if (item.requiresCustomization && item.customizationCategory?.length) {
      const optionsByCategory = await Promise.all(
        item.customizationCategory.map(async (catId) => {
          try {
            const allItemsSnap = await getDocs(
              query(collection(db, "items"), where("active", "==", true))
            );

            const filtered = allItemsSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter(doc => {
                const categoryField = doc.categoryId;
                const actualCategoryId = typeof categoryField === "string"
                  ? categoryField.trim()
                  : categoryField?.id;
                return actualCategoryId === catId.trim();
              });

            return {
              categoryId: catId.trim(),
              options: filtered,
            };
          } catch (err) {
            return { categoryId: catId.trim(), options: [] };
          }
        })
      );

      const cat01 = optionsByCategory.find(c => c.categoryId === "cat01" && c.options.length > 0);
      const cat05 = optionsByCategory.find(c => c.categoryId === "cat05" && c.options.length > 0);

      if (cat01) {
        setCustomizationOptions([cat01]);
        setSelectedMeal(item);
        setCustomizationStep(0);
        setShowCustomizationPopup(true);

        if (cat05) setNextCustomization(cat05); // wait for user to select bites
        return;
      }

      if (cat05) {
        setCustomizationOptions([cat05]);
        setSelectedMeal(item);
        setCustomizationStep(1);
        setShowCustomizationPopup(true);
        return;
      }
    }

    // fallback normal add
    onAddItem({
      id: item.id,
      name: item.itemName,
      price: item.price,
      quantity: 1,
    });

    if (item.itemName.toLowerCase().includes("large")) return;

    const isBaseEligible = ELIGIBLE_BASE_ITEMS.includes(item.itemName.trim());
    const isMeal = item.categoryId === "meals";

    if (isBaseEligible || isMeal) {
      const upgrades = await getUpgradeOptions(isMeal);
      if (upgrades.length > 0) {
        setSelectedForUpgrade(item);
        setUpgradeOptions(upgrades);
        setShowUpgradePopup(true);
      }
    }
  } catch (err) {
    onAddItem({ id: item.id, name: item.itemName, price: item.price, quantity: 1 });
  }
};



// Helper function for upgrade pricing
const getUpgradeOptions = async (isMeal) => {
  const q = query(
    collection(db, "items"),
    where("categoryId", "==", "upgrades"),
    where("parentCategory", "==", "meals")
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    price: isMeal ? doc.data().price : 1.00, // £0.69 for meals, £1.00 for others
    stock: inventory[doc.id]?.totalStockOnHand || 0
  }));
};

const handleMealCustomization = (option, categoryId) => {
  if (!selectedMeal) return;

  onAddItem({
    id: selectedMeal.id,
    name: selectedMeal.itemName,
    price: selectedMeal.price,
    quantity: 1,
    customizations: {
      [categoryId]: {
        id: option.id,
        name: option.itemName,
        price: option.price || 0,
      },
    },
  });

  // CLOSE current (Bites) popup
setShowCustomizationPopup(false);

if (nextCustomization) {
  // Show Burger popup next
  setCustomizationOptions([nextCustomization]);
  setCustomizationStep(1);
  setShowCustomizationPopup(true);
  setNextCustomization(null);
} else {
  // All customizations done, now check for upgrade
  const hasEligibleFries = ELIGIBLE_MEAL_KEYWORDS.some(
    keyword => selectedMeal.itemName.includes(keyword)
  );

  if (hasEligibleFries) {
    getUpgradeOptions(true).then(upgrades => {
      if (upgrades.length > 0) {
        setSelectedForUpgrade(selectedMeal);
        setUpgradeOptions(upgrades);
        setShowUpgradePopup(true);
      }
    });
  }

  setSelectedMeal(null); // reset
}


  // CLOSE current (Bites) popup
  setShowCustomizationPopup(false);

  // IF Burger step exists, open now
  if (nextCustomization) {
    setCustomizationOptions([nextCustomization]);
    setCustomizationStep(1);
    setShowCustomizationPopup(true);
    setNextCustomization(null);
  } else {
    setSelectedMeal(null);
  }
};


// In handleAddUpgrade (MenuGrid.jsx)
const handleAddUpgrade = (upgrade) => {
  if (!selectedForUpgrade) {
    console.error("No base item selected for upgrade.");
    return;
  }

  const baseId = upgrade.id; // like "upgrade1"
  const parentId = selectedForUpgrade.id;

  // Locally unique ID for KOT list, but still tied to base upgrade
  const kotItemId = `${baseId}__${parentId}`; // safe separator

  onAddItem({
    id: kotItemId, // unique for KOT tracking
    name: upgrade.itemName,
    price: upgrade.price,
    quantity: 1,
    isUpgrade: true,
    parentItem: parentId,
    itemName: upgrade.itemName || "Upgrade",
    originalUpgradeId: baseId, // important for inventory check
  });

  setSelectedForUpgrade(null);
  setShowUpgradePopup(false);
};


  const handleSelectSauce = (sauce) => {
    if (selectedItem) {
      onAddItem({
        id: selectedItem.id,
        name: selectedItem.itemName,
        price: selectedItem.price,
        sauces: sauce ? [sauce] : [],
        quantity: 1,
      });
    }
    setShowSaucePopup(false);
    setSelectedItem(null);
  };

  const handleAddOffer = async (offer) => {
    try {
      // Check if offer is already applied
      if (appliedOffers.some((o) => o.id === offer.id)) {
        alert("This offer is already applied!");
        return;
      }

      // Get fresh offer data
      const offerSnap = await getDoc(doc(db, "Offers", offer.id));
      const offerData = offerSnap.data();

      // Calculate discount
      const originalTotal = offer.items.reduce(
        (sum, item) => sum + item.price,
        0
      );
      const discount = originalTotal - offerData.offerPrice;

      // Apply offer
      onApplyOffer(discount, {
        id: offer.id,
        name: offerData.title,
        discountAmount: discount,
        items: offer.items.map((i) => i.id),
      });

      // Add items with offer association
      offer.items.forEach((item) => {
        onAddItem({
          id: item.id,
          name: item.itemName,
          price: item.price,
          quantity: 1,
          associatedOffer: offer.id,
        });
      });
    } catch (error) {
      console.error("Error applying offer:", error);
    }
  };

  const handleCategoryClick = (categoryId) => {
    console.log(categoryId);
    setSelectedCategoryId(categoryId);
    setShowOffers(false);
  };

  const handleShowOffers = () => {
    setSelectedCategoryId(null);
    setShowOffers(true);
  };

  return (
    <div className="flex flex-row w-full h-[calc(100vh-140px)] overflow-hidden">
      {/* Categories */}
      <div className="w-[180px] bg-purple-800 text-white p-2 flex flex-col gap-1 overflow-y-auto">
        <button
          onClick={handleShowOffers}
          className={`py-2 px-2 rounded text-left tracking-wide mb-2 ${
            showOffers && !selectedCategoryId
              ? "bg-white text-purple-800 font-bold"
              : "bg-purple-900 hover:bg-purple-600"
          } transition`}
        >
          🔥 OFFERS
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`py-2 px-2 rounded text-left tracking-wide ${
              selectedCategoryId === cat.id
                ? "bg-white text-purple-800 font-bold"
                : "bg-purple-700 hover:bg-purple-600"
            } transition`}
          >
            {cat.name?.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Items or Offers */}
      <div className="flex-1 p-4 bg-purple-100 overflow-y-auto">
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : selectedCategoryId ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {filteredItems.map((item) => {
              const stock = inventory[item.id]?.totalStockOnHand;
              const isClickable = stock > 0 && !item.isUpgrade;

              return (
                <button
                  key={item.id}
                  onClick={
                    isClickable ? () => handleItemClick(item) : undefined
                  }
                  disabled={!isClickable}
                  className={`rounded p-1 shadow-md text-white text-center flex flex-col justify-center items-center transition ${
                    isClickable ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                  style={{
                    backgroundColor: item.itemName
                      .toLowerCase()
                      .includes("chicken")
                      ? "#e60000"
                      : item.itemName.toLowerCase().includes("paneer")
                      ? "#1f3b73"
                      : "#22594c",
                  }}
                >
                  <div>{item.itemName.toUpperCase()}</div>
                  <div className="text-xl mt-3">£{item.price}</div>
                  {stock !== undefined && stock <= 0 && (
                    <div className="text-xs text-white-500 mt-1">
                      Out of stock
                    </div>
                  )}
                  {stock !== undefined && stock > 0 && stock < 10 && (
                    <div className="text-xs text-white-600 mt-1">
                      Low stock: {stock} left
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          showOffers && (
            <div className="h-full">
              <h2 className="text-3xl font-bold mb-6 text-purple-900 text-center">
                TODAY'S SPECIAL OFFERS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className={`${offer.color} rounded-xl shadow-xl overflow-hidden text-white transform hover:scale-105 transition duration-300`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-2xl font-bold mb-2">
                            {offer.title}
                          </h3>
                          <p className="text-lg mb-4">
                            {offer.items
                              .map((item) => item.itemName)
                              .join(" + ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-bold">
                            £{offer.offerPrice}
                          </span>
                          <span className="block text-sm line-through opacity-80">
                            £{offer.originalPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                          SAVE{" "}
                          {Math.round(
                            ((offer.originalPrice - offer.offerPrice) /
                              offer.originalPrice) *
                              100
                          )}
                          %
                        </span>
                        <button
                          onClick={() => handleAddOffer(offer)}
                          className="bg-white text-purple-800 px-4 py-2 rounded-lg font-bold hover:bg-purple-100 transition"
                        >
                          ADD TO ORDER
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

     {showCustomizationPopup && selectedMeal && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-40">
    <div className="bg-white rounded-lg p-5 shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
      <h2 className="text-xl font-bold mb-5 text-purple-900">
        Customize {selectedMeal.itemName}
      </h2>

      {customizationOptions.length > 0 ? (
        <div className="space-y-6">
          {customizationOptions.map((category) => (
            <div key={category.categoryId}>
              <h3 className="font-semibold mb-3 text-lg border-b pb-2">
                {category.categoryId === "cat01" 
                  ? "Choose Your Bites:" 
                  : category.categoryId === "cat05"
                  ? "Choose Your Burger:"
                  : "Choose Your Option:"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {category.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleMealCustomization(option, category.categoryId)}
                    className="p-3 bg-purple-100 hover:bg-purple-200 rounded-lg text-left transition"
                  >
                    <div className="font-semibold">{option.itemName}</div>
                    {option.price > 0 && (
                      <div className="text-sm">+£{option.price.toFixed(2)}</div>
                    )}
                    {inventory[option.id]?.totalStockOnHand <= 0 && (
                      <div className="text-xs text-red-500 mt-1">Out of stock</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No customization options available</div>
      )}

      <button
        onClick={() => setShowCustomizationPopup(false)}
        className="mt-6 w-full py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
      >
        No Thanks 
      </button>
    </div>
  </div>
)}

      {showUpgradePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-5 shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-5 text-purple-900">
              Available Upgrades for {selectedForUpgrade?.itemName}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {upgradeOptions.map((upgrade) => {
                const isOutOfStock =
                  (inventory[upgrade.id]?.totalStockOnHand || 0) <= 0;

                return (
                  <button
                    key={upgrade.id}
                    onClick={() => !isOutOfStock && handleAddUpgrade(upgrade)}
                    className={`p-3 rounded-lg text-left ${
                      isOutOfStock
                        ? "bg-gray-200 cursor-not-allowed"
                        : "bg-blue-100 hover:bg-blue-200"
                    }`}
                    disabled={isOutOfStock}
                  >
                    <div className="font-semibold">{upgrade.itemName}</div>
                    <div className="text-sm">+£{upgrade.price.toFixed(2)}</div>
                    {isOutOfStock && (
                      <div className="text-red-500 text-xs mt-1">
                        Out of stock
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowUpgradePopup(false)}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              No Thanks
            </button>
          </div>
        </div>
      )}

      {/* Sauce Popup */}
      {showSaucePopup && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-40">
          <div className="bg-white rounded-lg p-5 shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-5 text-purple-900">
              Select Sauce for {selectedItem.itemName}
            </h2>

            {sauceOptions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {sauceOptions.map((sauce, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSauce(sauce)}
                    className="bg-green-300 hover:bg-green-300 text-black px-3 py-3 rounded text-sm"
                  >
                    {sauce}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-gray-300 mb-3">No sauces available</div>
            )}

            <button
              onClick={() => handleSelectSauce(null)}
              className="mt-4 px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600"
            >
              No Sauce
            </button>

            <button
              onClick={() => {
                setShowSaucePopup(false);
                setSelectedItem(null);
              }}
              className="mt-2 ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}