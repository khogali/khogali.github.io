// Data structure for plans with initial pricing and updated line prices, including max line limits
const plans = [
    {
        type: "Go5G Next",
        firstLinePrice: 105,
        secondLinePrice: 75,
        line3To8Price: 50,
        line9To12Price: 60,
        maxLines: 12
    },
    {
        type: "Go5G Plus",
        firstLinePrice: 95,
        secondLinePrice: 65,
        line3To8Price: 40,
        line9To12Price: 50,
        maxLines: 12
    },
    {
        type: "Go5G",
        firstLinePrice: 80,
        secondLinePrice: 60,
        line3To8Price: 30,
        line9To12Price: 40,
        maxLines: 12
    },
    {
        type: "Essentials",
        firstLinePrice: 65,
        secondLinePrice: 55,
        line3To6Price: 15,
        maxLines: 6
    },
    {
        type: "Go5G Next 55+",
        firstLinePrice: 85,
        secondLinePrice: 45,
        line3To4Price: 65,
        maxLines: 4
    },
    {
        type: "Go5G Plus 55+",
        firstLinePrice: 75,
        secondLinePrice: 35,
        line3To4Price: 55,
        maxLines: 4
    },
    {
        type: "Go5G 55+",
        firstLinePrice: 60,
        secondLinePrice: 25,
        line3To4Price: 45,
        maxLines: 4
    },
    {
        type: "Go5G Next Military",
        firstLinePrice: 85,
        secondLinePrice: 50,
        line3To6Price: 40,
        line7To8Price: 45,
        line9To12Price: 55,
        maxLines: 12
    },
    {
        type: "Go5G Plus Military",
        firstLinePrice: 75,
        secondLinePrice: 40,
        line3To6Price: 30,
        line7To8Price: 40,
        line9To12Price: 45,
        maxLines: 12
    },
    {
        type: "Go5G Military",
        firstLinePrice: 60,
        secondLinePrice: 35,
        line3To6Price: 20,
        line7To8Price: 30,
        line9To12Price: 35,
        maxLines: 12
    },
    {
        type: "Go5G Next First Responder",
        firstLinePrice: 85,
        secondLinePrice: 50,
        line3To6Price: 40,
        line7To8Price: 45,
        line9To12Price: 55,
        maxLines: 12
    },
    {
        type: "Go5G Plus First Responder",
        firstLinePrice: 75,
        secondLinePrice: 40,
        line3To6Price: 30,
        line7To8Price: 40,
        line9To12Price: 45,
        maxLines: 12
    },
    {
        type: "Go5G First Responder",
        firstLinePrice: 65,
        secondLinePrice: 35,
        line3To6Price: 20,
        line7To8Price: 30,
        line9To12Price: 35,
        maxLines: 12
    }
];

function updateMaxLines() {
    const planType = document.getElementById('plan-type').value;
    const linesInput = document.getElementById('lines');
    const selectedPlan = plans.find(plan => plan.type === planType);

    if (selectedPlan) {
        linesInput.max = selectedPlan.maxLines;
    } else {
        linesInput.max = 12;  // Default max for any plan that allows up to 12 lines
    }
}

function calculateTotalPrice(plan, numLines) {
    let totalPrice = 0;
    let lineCostDetails = [];

    if (numLines >= 1) {
        totalPrice += plan.firstLinePrice;
        lineCostDetails.push(`1st line: $${plan.firstLinePrice}`);
    }
    if (numLines >= 2) {
        totalPrice += plan.secondLinePrice;
        lineCostDetails.push(`2nd line: $${plan.secondLinePrice}`);
    }
    
    if (plan.type.includes('55+')) {
        if (numLines >= 3 && numLines <= 4) {
            totalPrice += (numLines - 2) * plan.line3To4Price;
            lineCostDetails.push(`3rd to 4th lines: $${plan.line3To4Price} each`);
        }
    } else if (plan.type.includes('Military') || plan.type.includes('First Responder')) {
        if (numLines >= 3 && numLines <= 6) {
            totalPrice += (numLines - 2) * plan.line3To6Price;
            lineCostDetails.push(`3rd to 6th lines: $${plan.line3To6Price} each`);
        } else if (numLines >= 7 && numLines <= 8) {
            totalPrice += 4 * plan.line3To6Price + (numLines - 6) * plan.line7To8Price;
            lineCostDetails.push(`7th to 8th lines: $${plan.line7To8Price} each`);
        } else if (numLines >= 9 && numLines <= 12) {
            totalPrice += 4 * plan.line3To6Price + 2 * plan.line7To8Price + (numLines - 8) * plan.line9To12Price;
            lineCostDetails.push(`9th to 12th lines: $${plan.line9To12Price} each`);
        }
    } else if (numLines >= 3 && numLines <= 8) {
        totalPrice += (numLines - 2) * plan.line3To8Price;
        lineCostDetails.push(`3rd to 8th lines: $${plan.line3To8Price} each`);
    } else if (numLines >= 9 && numLines <= 12) {
        totalPrice += 6 * plan.line3To8Price + (numLines - 8) * plan.line9To12Price;
        lineCostDetails.push(`9th to 12th lines: $${plan.line9To12Price} each`);
    }

    return { totalPrice, lineCostDetails };
}

function filterPlans() {
    const planType = document.getElementById('plan-type').value;
    let numLines = parseInt(document.getElementById('lines').value);
    const applyAutoPay = document.getElementById('apply-autopay').checked;
    const insuranceLines = parseInt(document.getElementById('insurance-lines').value);
    const addTaxes = document.getElementById('add-taxes').checked;
    const planList = document.getElementById('plan-list');

    planList.innerHTML = ''; // Clear previous results

    const filteredPlans = plans.filter(plan => planType === 'all' || plan.type.includes(planType));
    const selectedPlan = filteredPlans.find(plan => plan.type === planType);

    if (selectedPlan) {
        if (numLines > selectedPlan.maxLines) {
            numLines = selectedPlan.maxLines; // Limit the number of lines to the plan's max
        }
    }

    filteredPlans.forEach(plan => {
        const { totalPrice, lineCostDetails } = calculateTotalPrice(plan, numLines);

        let basePrice = totalPrice;

        // Apply AutoPay Discount (first 4 lines) if selected
        if (applyAutoPay) {
            const discountLines = Math.min(numLines, 4);
            basePrice -= 5 * discountLines;
        }

        // Add $18 per line for the selected number of insurance lines
        const insuranceCost = 18 * insuranceLines;

        // Final total price before taxes
        let finalPrice = basePrice + insuranceCost;

        // Apply 8% tax if the plan is Essentials and taxes are selected
        if (plan.type === "Essentials" && addTaxes) {
            finalPrice *= 1.08;
        }

        planList.innerHTML += `
            <div class="plan-card">
                <h2>${plan.type}</h2>
                <p><strong>Total Price for ${numLines} line(s): $${finalPrice.toFixed(2)}/mo</strong></p>
                <p>Cost Breakdown:</p>
                <ul>
                    ${lineCostDetails.map(detail => `<li>${detail}</li>`).join('')}
                </ul>
            </div>
        `;
    });
}

document.getElementById('plan-type').addEventListener('change', updateMaxLines);
