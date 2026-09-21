import SwiftUI

public struct PricingCalculatorView: View {
    @Bindable var opsVM: OpsViewModel
    
    public init(opsVM: OpsViewModel) {
        self.opsVM = opsVM
    }
    
    private var scenario: PricingScenario { opsVM.pricingScenario }
    private var ranked: [PricingRankedSite] { opsVM.rankedCompareSites }
    private var cheapest: PricingRankedSite? { ranked.first { $0.price != nil } }
    private var highest: PricingRankedSite? {
        ranked.last { $0.price != nil }
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                scenarioHeader
                presetRow
                scenarioControls
                addonSection
                servicePicker
                insightStrip
                rankingList
            }
            .padding(AppSpacing.md)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
    }
    
    private var scenarioHeader: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xxs) {
            Text("Quote any home")
                .font(.title3.weight(.semibold))
            Text("Compare markets by total quote and cents per square foot.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(scenario.label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    private var presetRow: some View {
        HStack(spacing: AppSpacing.xs) {
            ForEach(PricingScenarioPreset.allCases) { preset in
                Button {
                    opsVM.applyPreset(preset)
                    HapticFeedback.impact(.light)
                } label: {
                    Text(preset.title)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .foregroundStyle(isActivePreset(preset) ? Color.white : Color.primary)
                        .background(
                            isActivePreset(preset)
                                ? AppColors.primary
                                : Color.secondary.opacity(0.12)
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
            Button("Reset") {
                opsVM.resetScenario()
                HapticFeedback.impact(.light)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppColors.primary)
        }
    }
    
    private var scenarioControls: some View {
        VStack(spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.sm) {
                stepperCard(title: "Beds", value: scenario.bedrooms, range: 0...8) { value in
                    var next = scenario
                    next.bedrooms = value
                    opsVM.updateScenario(next)
                }
                stepperCard(title: "Baths", value: scenario.bathrooms, range: 1...8) { value in
                    var next = scenario
                    next.bathrooms = value
                    opsVM.updateScenario(next)
                }
            }
            
            HStack(spacing: AppSpacing.sm) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Square feet")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField(
                        "2000",
                        value: Binding(
                            get: { scenario.squareFeet },
                            set: { value in
                                var next = scenario
                                next.squareFeet = min(10000, max(400, value))
                                opsVM.updateScenario(next)
                            }
                        ),
                        format: .number
                    )
                    .platformKeyboardType(.numberPad)
                    .padding(10)
                    .background(Color.secondary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                stepperCard(title: "Hours", value: scenario.hours, range: 1...8) { value in
                    var next = scenario
                    next.hours = value
                    opsVM.updateScenario(next)
                }
            }
            
            HStack(spacing: AppSpacing.sm) {
                labeledMenu(
                    title: "Property",
                    value: scenario.propertyTypeKey.capitalized,
                    options: ["house", "apartment", "condo", "townhouse"]
                ) { key in
                    var next = scenario
                    next.propertyTypeKey = key
                    opsVM.updateScenario(next)
                }
                labeledMenu(
                    title: "Condition",
                    value: scenario.conditionKey,
                    options: ["Average", "Light", "Heavy"]
                ) { key in
                    var next = scenario
                    next.conditionKey = key
                    opsVM.updateScenario(next)
                }
            }
        }
        .padding(AppSpacing.md)
        .glassCard()
    }
    
    @ViewBuilder
    private var addonSection: some View {
        let options = opsVM.addonCatalog
        if !options.isEmpty {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Add-ons")
                    .font(.subheadline.weight(.semibold))
                Text("Applied only where a market offers the match.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                FlowAddonChips(
                    options: options,
                    selected: Set(scenario.addonKeys)
                ) { key in
                    opsVM.toggleAddon(key)
                    HapticFeedback.selection()
                }
            }
            .padding(AppSpacing.md)
            .glassCard()
        }
    }
    
    private var servicePicker: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text("Compare service")
                .font(.subheadline.weight(.semibold))
            Picker("Service", selection: $opsVM.selectedCompareService) {
                ForEach(PricingCanonicalService.allCases) { service in
                    Text(service.label).tag(service)
                }
            }
            #if os(iOS)
            .pickerStyle(.menu)
            #endif
        }
        .padding(AppSpacing.md)
        .glassCard()
    }
    
    private var insightStrip: some View {
        HStack(spacing: AppSpacing.sm) {
            insightCard(
                title: "Cheapest",
                value: cheapest?.displayPrice ?? "—",
                detail: cheapestDetail,
                color: AppColors.emerald
            )
            insightCard(
                title: "Spread",
                value: spreadText,
                detail: highest.map { "Up to \($0.displayPrice)" } ?? "Need 2+",
                color: AppColors.amber
            )
        }
    }
    
    private var cheapestDetail: String {
        guard let cheapest else { return "No quote" }
        if let rate = centsPerSqftLabel(for: cheapest.price) {
            return "\(cheapest.siteName) · \(rate)"
        }
        return cheapest.siteName
    }
    
    private var spreadText: String {
        guard let low = cheapest?.price, let high = highest?.price, high > low else {
            return "—"
        }
        return String(format: "$%.0f", high - low)
    }
    
    private var rankingList: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text("Markets")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if opsVM.isLoadingCompare {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            
            if ranked.isEmpty {
                Text("No pricing configured yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(Array(ranked.enumerated()), id: \.element.id) { index, site in
                    rankedRow(site: site, rank: index + 1)
                }
            }
        }
    }
    
    private func rankedRow(site: PricingRankedSite, rank: Int) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Text("\(rank)")
                .font(.caption.monospacedDigit().weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: 22, alignment: .trailing)
            
            Circle()
                .fill(Color(hex: site.accentColorHex ?? "") ?? AppColors.primary)
                .frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(site.siteName)
                    .font(.subheadline.weight(.semibold))
                if let engine = site.engine {
                    Text(engine)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(site.displayPrice)
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(
                        site.price == nil
                            ? AppColors.amber
                            : (rank == 1 ? AppColors.emerald : .primary)
                    )
                if let rate = centsPerSqftLabel(for: site.price) {
                    Text(rate)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(AppSpacing.sm)
        .glassCard()
    }
    
    /// Derived cleaning rate: total quote ÷ home size, shown as cents per sq ft.
    private func centsPerSqftLabel(for price: Double?) -> String? {
        guard let price, scenario.squareFeet > 0 else { return nil }
        let cents = Int((price / Double(scenario.squareFeet) * 100).rounded())
        return "\(cents)¢ / sq ft"
    }
    
    private func insightCard(title: String, value: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
            Text(detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.sm)
        .glassCard()
    }
    
    private func stepperCard(
        title: String,
        value: Int,
        range: ClosedRange<Int>,
        onChange: @escaping (Int) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button {
                    onChange(max(range.lowerBound, value - 1))
                } label: {
                    Image(systemName: "minus")
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)
                .disabled(value <= range.lowerBound)
                
                Text("\(value)")
                    .font(.headline.monospacedDigit())
                    .frame(maxWidth: .infinity)
                
                Button {
                    onChange(min(range.upperBound, value + 1))
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.bordered)
                .disabled(value >= range.upperBound)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.secondary.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    
    private func labeledMenu(
        title: String,
        value: String,
        options: [String],
        onSelect: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option.capitalized) { onSelect(option) }
                }
            } label: {
                HStack {
                    Text(value)
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .background(Color.secondary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private func isActivePreset(_ preset: PricingScenarioPreset) -> Bool {
        let p = preset.scenario
        return p.bedrooms == scenario.bedrooms
            && p.bathrooms == scenario.bathrooms
            && p.squareFeet == scenario.squareFeet
            && scenario.addonKeys.isEmpty
    }
}

private struct FlowAddonChips: View {
    let options: [PricingAddonOption]
    let selected: Set<String>
    let onToggle: (String) -> Void
    
    var body: some View {
        FlexibleChipWrap(spacing: 8) {
            ForEach(options) { option in
                let active = selected.contains(option.key)
                Button {
                    onToggle(option.key)
                } label: {
                    Text(option.label)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            active
                                ? AppColors.emerald.opacity(0.15)
                                : Color.secondary.opacity(0.1)
                        )
                        .foregroundStyle(active ? AppColors.emerald : .primary)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(
                                    active ? AppColors.emerald.opacity(0.35) : Color.clear,
                                    lineWidth: 1
                                )
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Lightweight wrap layout for addon chips without pulling in extra deps.
private struct FlexibleChipWrap<Content: View>: View {
    var spacing: CGFloat
    @ViewBuilder var content: Content
    
    var body: some View {
        // Simple horizontal scroll keeps density manageable on phone.
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: spacing) {
                content
            }
        }
    }
}
