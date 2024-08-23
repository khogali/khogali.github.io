
// Data structure for plans based on the provided images
const plans = [
    {
        type: "Go5G Next",
        individualPrice: 100,
        familyPrice: 70,
        addLinePrice: 45,
        description: "Unlimited talk, text, and 5G & 4G LTE smartphone data. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G Plus",
        individualPrice: 90,
        familyPrice: 60,
        addLinePrice: 40,
        description: "Unlimited talk, text, and 5G & 4G LTE smartphone data. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G",
        individualPrice: 75,
        familyPrice: 55,
        addLinePrice: 35,
        description: "Unlimited talk, text, and 5G & 4G LTE smartphone data. Includes 15 GB of high-speed mobile hotspot data."
    },
    {
        type: "Essentials",
        individualPrice: 60,
        familyPrice: 30,
        addLinePrice: 25,
        description: "Unlimited talk, text, and 5G & 4G LTE smartphone data. Includes unlimited 3G mobile hotspot data."
    },
    {
        type: "Go5G Next 55+",
        individualPrice: 80,
        familyPrice: 60,
        addLinePrice: 40,
        description: "Discounted plan for customers aged 55+. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G Plus 55+",
        individualPrice: 70,
        familyPrice: 50,
        addLinePrice: 35,
        description: "Discounted plan for customers aged 55+. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G 55+",
        individualPrice: 55,
        familyPrice: 40,
        addLinePrice: 30,
        description: "Discounted plan for customers aged 55+. Includes 15 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G Next Military / First Responder",
        individualPrice: 80,
        familyPrice: 60,
        addLinePrice: 40,
        description: "Discounted plan for military and first responders. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G Plus Military / First Responder",
        individualPrice: 70,
        familyPrice: 50,
        addLinePrice: 35,
        description: "Discounted plan for military and first responders. Includes 50 GB of high-speed mobile hotspot data."
    },
    {
        type: "Go5G Military / First Responder",
        individualPrice: 60,
        familyPrice: 40,
        addLinePrice: 30,
        description: "Discounted plan for military and first responders. Includes 15 GB of high-speed mobile hotspot data."
    },
    {
        type: "PlusUp (Add-on)",
        individualPrice: 15,
        familyPrice: 15,
        addLinePrice: 15,
        description: "Add-on package for Go5G plans that includes additional premium benefits like unlimited premium data, 50 GB high-speed hotspot, and more."
    }
];

function filterPlans() {
    const planType = document.getElementById('plan-type').value;
    const numLines = parseInt(document.getElementById('lines').value);
    const useInsiderCode = document.getElementById('insider-code').checked;
    const planList = document.getElementById('plan-list');

    planList.innerHTML = ''; // Clear previous results

    // Filter and display plans based on the selected criteria
    const filteredPlans = plans.filter(plan => planType === 'all' || plan.type.includes(planType));

    filteredPlans.forEach(plan => {
        let totalPrice = (numLines === 1) ? plan.individualPrice : plan.familyPrice + (numLines - 2) * plan.addLinePrice;

        // Apply a 20% discount if the Insider Code is used
        if (useInsiderCode) {
            totalPrice *= 0.8;
        }

        planList.innerHTML += `
            <div class="plan-card">
                <h2>${plan.type}</h2>
                <p>${plan.description}</p>
                <p>Price for ${numLines} line(s): $${totalPrice.toFixed(2)}/mo</p>
            </div>
        `;
    });
}
