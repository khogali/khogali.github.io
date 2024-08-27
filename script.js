const plans = [
    // Regular Plans
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
        secondLinePrice: 35,
        line3To6Price: 15,
        maxLines: 6
    },
    // 55+ Plans
    {
        type: "Go5G Next 55+",
        firstLinePrice: 85,
        secondLinePrice: 65,
        line3To4Price: 60,
        maxLines: 4
    },
    {
        type: "Go5G Plus 55+",
        firstLinePrice: 75,
        secondLinePrice: 55,
        line3To4Price: 50,
        maxLines: 4
    },
    {
        type: "Go5G 55+",
        firstLinePrice: 60,
        secondLinePrice: 50,
        line3To4Price: 40,
        maxLines: 4
    },
    // Military/First Responder Plans
    {
        type: "Go5G Next Military/First Responder",
        firstLinePrice: 80,
        secondLinePrice: 70,
        line3To6Price: 55,
        line7To8Price: 60,
        line9To12Price: 65,
        maxLines: 12
    },
    {
        type: "Go5G Plus Military/First Responder",
        firstLinePrice: 70,
        secondLinePrice: 60,
        line3To6Price: 45,
        line7To8Price: 50,
        line9To12Price: 55,
        maxLines: 12
    },
    {
        type: "Go5G Military/First Responder",
        firstLinePrice: 55,
        secondLinePrice: 45,
        line3To6Price: 30,
        line7To8Price: 35,
        line9To12Price: 40,
        maxLines: 12
    }
];

document.querySelectorAll('.controls input, .controls select').forEach(input => {
    input.addEventListener('input', comparePlans);
});

function comparePlans() {
    const customPlanName = document.getElementById('custom-plan-name').value || "Old Plan";
    const customTotalPrice = parseFloat(document.getElementById('custom-total-price').value) || 0;
    const customLines = parseInt(document.getElementById('custom-lines').value);
    const customInsuranceLines = parseInt(document.getElementById('custom-insurance-lines').value);
    const customApplyAutoPay = document.getElementById('custom-apply-autopay').checked;
    const customTaxPercentage = parseFloat(document.getElementById('custom-tax-percentage').value) || 0;

    const planType = document.getElementById('plan-type').value;
    const numLines = parseInt(document.getElementById('lines').value);
    const insuranceLines = parseInt(document.getElementById('insurance-lines').value);
    const applyAutoPay = document.getElementById('apply-autopay').checked;
    const addTaxes = document.getElementById('add-taxes').checked;

    const plan = plans.find(p => p.type === planType);
    
    let tmobilePlanTotal = calculateTotalPrice(plan, numLines, insuranceLines, applyAutoPay, addTaxes).totalPrice;

    // Adjust custom plan total with insurance and autopay discounts
    let adjustedCustomTotal = customTotalPrice + customInsuranceLines * 18;
    if (customApplyAutoPay) {
        adjustedCustomTotal -= Math.min(customLines, 4) * 5;
    }
    if (customTaxPercentage > 0) {
        adjustedCustomTotal *= (1 + customTaxPercentage / 100);
    }

    const warning = document.getElementById('warning');
    if (customTaxPercentage > 50) {
        warning.textContent = 'Warning: A high tax percentage might result in an unexpectedly high total cost.';
    } else {
        warning.textContent = '';
    }

    const comparisonResults = document.getElementById('comparison-results');
    const priceDifference = adjustedCustomTotal - tmobilePlanTotal;
    const percentageChange = ((priceDifference / tmobilePlanTotal) * 100).toFixed(2);
    const differenceColor = priceDifference > 0 ? 'red' : 'green';  // Red if the custom plan is more expensive, green if it's cheaper

    comparisonResults.innerHTML = `
        <div class="plan-card">
            <h2>Custom Plan: ${customPlanName}</h2>
            <p><strong style="color: red;">Total Price: $${adjustedCustomTotal.toFixed(2)}/mo</strong></p>
        </div>
        <div class="plan-card">
            <h2>T-Mobile Plan: ${plan.type}</h2>
            <p><strong>Total Price: $${tmobilePlanTotal.toFixed(2)}/mo</strong></p>
        </div>
        <div class="plan-card" style="color: ${differenceColor};">
            <h2>Comparison</h2>
            <p>Difference in Price: $${priceDifference.toFixed(2)}</p>
            <p>Percentage Change: ${percentageChange}%</p>
        </div>
    `;
}

function calculateTotalPrice(plan, numLines, insuranceLines, applyAutoPay, addTaxes) {
    let totalPrice = 0;

    if (numLines >= 1) {
        totalPrice += plan.firstLinePrice || 0;
    }
    if (numLines >= 2) {
        totalPrice += plan.secondLinePrice || 0;
    }
    
    if (plan.type.includes('55+') && numLines <= plan.maxLines) {
        if (numLines >= 3 && numLines <= 4) {
            totalPrice += (numLines - 2) * (plan.line3To4Price || 0);
        }
    } else if (plan.type.includes('Military/First Responder') && numLines <= plan.maxLines) {
        if (numLines >= 3 && numLines <= 6) {
            totalPrice += (numLines - 2) * (plan.line3To6Price || 0);
        } else if (numLines >= 7 && numLines <= 8) {
            totalPrice += 4 * (plan.line3To6Price || 0) + (numLines - 6) * (plan.line7To8Price || 0);
        } else if (numLines >= 9 && numLines <= 12) {
            totalPrice += 4 * (plan.line3To6Price || 0) + 2 * (plan.line7To8Price || 0) + (numLines - 8) * (plan.line9To12Price || 0);
        }
    } else if (!plan.type.includes('55+') && !plan.type.includes('Military/First Responder')) {
        if (numLines >= 3 && numLines <= 8) {
            totalPrice += (numLines - 2) * (plan.line3To8Price || 0);
        } else if (numLines >= 9 && numLines <= 12) {
            totalPrice += 6 * (plan.line3To8Price || 0) + (numLines - 8) * (plan.line9To12Price || 0);
        }
    }

    // Essentials plan fix
    if (plan.type === "Essentials") {
        if (numLines >= 3 && numLines <= plan.maxLines) {
            totalPrice += (numLines - 2) * plan.line3To6Price;
        }
    }

    // Apply insurance cost
    totalPrice += insuranceLines * 18;

    // Apply AutoPay discount
    if (applyAutoPay) {
        totalPrice -= Math.min(numLines, 4) * 5;
    }

    // Apply tax if selected and plan is Essentials
    if (addTaxes && plan.type === "Essentials") {
        totalPrice *= 1.08; // Assume tax is 8%
    }

    return { totalPrice };
}

function updateMaxLines() {
    const planType = document.getElementById('plan-type').value;
    const linesInput = document.getElementById('lines');
    const plan = plans.find(p => p.type.includes(planType));

    if (plan) {
        linesInput.max = plan.maxLines;
    } else {
        linesInput.max = 12; // Default max
    }
}
