import SwiftUI

public struct PricingOpsView: View {
    @ObservedObject var opsVM: OpsViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedSlug: String?
    @State private var mode: PricingMode = .calculator
    
    private enum PricingMode: String, CaseIterable, Identifiable {
        case calculator
        case edit
        
        var id: String { rawValue }
        var title: String {
            switch self {
            case .calculator: return "Calculator"
            case .edit: return "Edit"
            }
        }
    }
    
    public init(opsVM: OpsViewModel) {
        self.opsVM = opsVM
    }
    
    private var selectedRow: SitePricingRow? {
        guard let selectedSlug else { return opsVM.sitePricingList.first }
        return opsVM.sitePricingList.first { $0.siteSlug == selectedSlug } ?? opsVM.sitePricingList.first
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            Picker("Mode", selection: $mode) {
                ForEach(PricingMode.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, AppSpacing.md)
            .padding(.top, AppSpacing.sm)
            .padding(.bottom, AppSpacing.xs)
            
            Group {
                if mode == .calculator {
                    PricingCalculatorView(opsVM: opsVM)
                } else if sizeClass == .regular {
                    iPadEditLayout
                } else {
                    phoneEditLayout
                }
            }
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("Live Pricing")
        .refreshable {
            opsVM.loadPricing()
            opsVM.refreshCompare()
        }
        .onAppear {
            opsVM.ensurePricingLoaded()
            if selectedSlug == nil {
                selectedSlug = opsVM.sitePricingList.first?.siteSlug
            }
        }
        .onChange(of: opsVM.sitePricingList) { list in
            if selectedSlug == nil || !list.contains(where: { $0.siteSlug == selectedSlug }) {
                selectedSlug = list.first?.siteSlug
            }
        }
    }
    
    private var phoneEditLayout: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                introCopy
                if opsVM.sitePricingList.isEmpty {
                    emptyState
                } else {
                    ForEach(opsVM.sitePricingList) { row in
                        NavigationLink {
                            PricingEditView(opsVM: opsVM, row: row)
                        } label: {
                            PricingSiteCard(row: row)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
    }
    
    private var iPadEditLayout: some View {
        HStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    introCopy
                    if opsVM.sitePricingList.isEmpty {
                        emptyState
                    } else {
                        ForEach(opsVM.sitePricingList) { row in
                            Button {
                                selectedSlug = row.siteSlug
                            } label: {
                                PricingSiteCard(row: row, isSelected: row.siteSlug == selectedSlug)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .frame(minWidth: 320, idealWidth: 360, maxWidth: 400)
            
            Divider()
            
            if let row = selectedRow {
                PricingEditView(opsVM: opsVM, row: row, embedsInSplit: true)
            } else {
                ContentUnavailableView(
                    "Select a site",
                    systemImage: "dollarsign.circle",
                    description: Text("Choose a cleaning site to edit live pricing.")
                )
            }
        }
    }
    
    private var introCopy: some View {
        Text("These numbers power each cleaning site’s online quote. Changes go live about a minute after you save.")
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 4)
    }
    
    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "dollarsign.circle")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No pricing configs found")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
    }
}

private struct PricingSiteCard: View {
    let row: SitePricingRow
    var isSelected: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(row.siteName)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Text(row.engine ?? row.configKind ?? "Standard")
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppColors.primary.opacity(0.12))
                    .foregroundStyle(AppColors.primary)
                    .clipShape(Capsule())
            }
            
            if row.entries.isEmpty {
                Text("Tap to edit rates")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Divider()
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(row.entries) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.name)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Text(entry.displayPrice)
                                .font(.caption.bold())
                                .foregroundStyle(AppColors.emerald)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(Color.secondary.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
        .padding(14)
        .glassCard()
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isSelected ? AppColors.primary : Color.clear, lineWidth: 2)
        )
    }
}

public struct PricingEditView: View {
    @ObservedObject var opsVM: OpsViewModel
    public let row: SitePricingRow
    public var embedsInSplit: Bool = false
    @Environment(\.dismiss) private var dismiss
    
    @State private var workingRow: SitePricingRow
    @State private var fields: [PricingEditableField] = []
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showingCopySheet = false
    
    public init(opsVM: OpsViewModel, row: SitePricingRow, embedsInSplit: Bool = false) {
        self.opsVM = opsVM
        self.row = row
        self.embedsInSplit = embedsInSplit
        _workingRow = State(initialValue: row)
    }
    
    private var compatibleSources: [SitePricingRow] {
        opsVM.sitePricingList.filter {
            $0.siteSlug != workingRow.siteSlug && workingRow.copyCompatible(with: $0)
        }
    }
    
    private var tenPercentFooter: String {
        var parts = [
            "Multiplies every dollar rate and per-sq-ft rate on this site (room fees, minimums, add-ons).",
            "Bedroom/bath caps and % spreads stay the same.",
            "Tap Save & Publish to push to the marketing site."
        ]
        if !compatibleSources.isEmpty {
            parts.append("Copy replaces this site’s numbers with another same-engine site.")
        } else {
            parts.append("Copy is only available when another site uses the same pricing engine.")
        }
        return parts.joined(separator: " ")
    }
    
    public var body: some View {
        Form {
            Section {
                Text(workingRow.siteName)
                    .font(.headline)
                HStack {
                    if let engine = workingRow.engine ?? workingRow.configKind {
                        Text(engine)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let version = workingRow.version {
                        Text("v\(version)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Section {
                HStack(spacing: 12) {
                    Button {
                        applyScale(0.9)
                    } label: {
                        VStack(spacing: 4) {
                            Label("Lower all by 10%", systemImage: "minus.circle.fill")
                                .font(.subheadline.weight(.semibold))
                            Text("−10%")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(AppColors.rose)
                    
                    Button {
                        applyScale(1.1)
                    } label: {
                        VStack(spacing: 4) {
                            Label("Raise all by 10%", systemImage: "plus.circle.fill")
                                .font(.subheadline.weight(.semibold))
                            Text("+10%")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(AppColors.emerald)
                }
                
                Button {
                    showingCopySheet = true
                } label: {
                    Label("Copy from another site…", systemImage: "doc.on.doc")
                }
                .disabled(compatibleSources.isEmpty)
            } header: {
                Text("Raise or lower every price")
            } footer: {
                Text(tenPercentFooter)
            }
            
            if fields.isEmpty {
                Section {
                    Text("No editable rate fields found for this engine.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Section("Main rates") {
                    ForEach($fields) { $field in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(field.label)
                                    .font(.subheadline)
                                Spacer()
                                if !field.unitCaption.isEmpty {
                                    Text(field.unitCaption)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                                TextField("0", value: $field.value, format: .number)
                                    .platformKeyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .frame(width: 90)
                            }
                            if let caption = field.secondaryCaption {
                                Text(caption)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                        }
                    }
                }
            }
            
            if !workingRow.entries.isEmpty {
                Section {
                    ForEach(workingRow.entries) { entry in
                        HStack {
                            Text(entry.name)
                                .font(.subheadline)
                            Spacer()
                            Text(entry.displayPrice)
                                .font(.subheadline.bold())
                                .foregroundStyle(AppColors.emerald)
                        }
                    }
                } header: {
                    Text("Reference basket")
                } footer: {
                    Text("Basket refreshes after you save and publish.")
                }
            }
            
            if let err = errorMessage {
                Section {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(AppColors.rose)
                }
            }
            
            if let successMessage {
                Section {
                    Text(successMessage)
                        .font(.caption)
                        .foregroundStyle(AppColors.emerald)
                }
            }
            
            Section {
                Button(action: save) {
                    if isSaving {
                        ProgressView()
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Save & Publish Live")
                            .frame(maxWidth: .infinity)
                    }
                }
                .bbPrimaryButton(isLoading: isSaving, expand: true)
                .disabled(isSaving || fields.isEmpty || workingRow.siteId == nil)
            } footer: {
                Text("Sites pull these numbers from Booking Broom within about a minute — no redeploy needed.")
            }
        }
        .navigationTitle(embedsInSplit ? workingRow.siteName : "Edit Pricing")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .onAppear { reloadFrom(row) }
        .onChange(of: row.siteSlug) { _ in
            if let latest = opsVM.sitePricingList.first(where: { $0.siteSlug == row.siteSlug }) {
                reloadFrom(latest)
            } else {
                reloadFrom(row)
            }
        }
        .sheet(isPresented: $showingCopySheet) {
            NavigationStack {
                List(compatibleSources) { source in
                    Button {
                        applyCopy(from: source)
                        showingCopySheet = false
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(source.siteName)
                                .foregroundStyle(.primary)
                            Text(source.engine ?? source.configKind ?? "")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .navigationTitle("Copy from")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingCopySheet = false }
                    }
                }
            }
            #if os(iOS)
            .presentationDetents([.medium, .large])
            #endif
        }
    }
    
    private func reloadFrom(_ source: SitePricingRow) {
        workingRow = source
        fields = source.editableMainRateFields()
        errorMessage = nil
        successMessage = nil
    }
    
    private func applyScale(_ factor: Double) {
        guard let scaled = workingRow.scaledBy(factor),
              let next = optionalRow(replacingConfig: scaled) else {
            errorMessage = "Could not scale rates"
            return
        }
        workingRow = next
        fields = next.editableMainRateFields()
        successMessage = factor > 1
            ? "All prices raised 10%. Save & Publish to go live."
            : "All prices lowered 10%. Save & Publish to go live."
        errorMessage = nil
        HapticFeedback.impact(.light)
    }
    
    private func applyCopy(from source: SitePricingRow) {
        guard let copied = workingRow.replacingConfig(from: source),
              let next = optionalRow(replacingConfig: copied) else {
            errorMessage = "Could not copy pricing — engines must match."
            return
        }
        workingRow = next
        fields = next.editableMainRateFields()
        successMessage = "Copied rates from \(source.siteName). Save to publish."
        errorMessage = nil
        HapticFeedback.impact(.medium)
    }
    
    private func optionalRow(replacingConfig data: Data) -> SitePricingRow? {
        var next = workingRow
        next.configJSON = data
        return next
    }
    
    private func save() {
        guard let siteId = workingRow.siteId,
              let updatedJSON = workingRow.applyingEdits(fields) else {
            errorMessage = "Missing site id or config"
            return
        }
        isSaving = true
        errorMessage = nil
        successMessage = nil
        Task {
            let ok = await opsVM.savePricing(
                siteId: siteId,
                configJSON: updatedJSON,
                summary: "Updated main rates from iOS app"
            )
            isSaving = false
            if ok {
                HapticFeedback.notification(.success)
                successMessage = "Published. Sites refresh within about a minute."
                if let latest = opsVM.sitePricingList.first(where: { $0.siteSlug == workingRow.siteSlug }) {
                    reloadFrom(latest)
                    successMessage = "Published v\(latest.version.map(String.init) ?? ""). Sites refresh within about a minute."
                }
                if !embedsInSplit {
                    dismiss()
                }
            } else {
                errorMessage = opsVM.pricingSaveError ?? "Save failed"
                HapticFeedback.notification(.error)
            }
        }
    }
}
