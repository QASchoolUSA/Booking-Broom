import SwiftUI

public struct ComposeSMSView: View {
    @Bindable var messagesVM: MessagesViewModel
    @Environment(\.dismiss) private var dismiss
    
    public var prefillTo: String?
    public var prefillSiteSlug: String?
    public var prefillSiteName: String?
    
    @State private var selectedDid: String = ""
    @State private var recipientPhone: String = ""
    @State private var messageBody: String = ""
    @State private var isSending: Bool = false
    @State private var errorMessage: String? = nil
    
    public init(
        messagesVM: MessagesViewModel,
        prefillTo: String? = nil,
        prefillSiteSlug: String? = nil,
        prefillSiteName: String? = nil
    ) {
        self.messagesVM = messagesVM
        self.prefillTo = prefillTo
        self.prefillSiteSlug = prefillSiteSlug
        self.prefillSiteName = prefillSiteName
    }
    
    public var body: some View {
        NavigationStack {
            Form {
                Section("From (Voip.ms Line)") {
                    if messagesVM.dids.isEmpty {
                        Text("No active DID lines found. Sync messages to refresh.")
                            .font(AppTypography.meta)
                            .foregroundStyle(.secondary)
                    } else {
                        #if os(macOS)
                        Picker("From", selection: $selectedDid) {
                            ForEach(messagesVM.dids) { did in
                                Text("\(did.label) — \(did.formatted)").tag(did.did)
                            }
                        }
                        .pickerStyle(.menu)
                        #else
                        HorizontalChipScrollView {
                            HStack(spacing: AppSpacing.xs) {
                                ForEach(messagesVM.dids) { did in
                                    let isSelected = selectedDid == did.did
                                    Button {
                                        selectedDid = did.did
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(did.label)
                                                .font(AppTypography.metaBold)
                                            Text(did.formatted)
                                                .font(AppTypography.micro)
                                        }
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(isSelected ? AppColors.primary : Color.secondary.opacity(0.12))
                                        .foregroundStyle(isSelected ? .white : .primary)
                                        .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.controlRadius, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .horizontalChipStrip(height: 52)
                        #endif
                    }
                }
                
                Section("To (Recipient Phone)") {
                    TextField("e.g. +1 407-555-0199", text: $recipientPhone)
                        .platformKeyboardType(.phonePad)
                }
                
                Section("Message Content (SMS)") {
                    TextField("Type your SMS message...", text: $messageBody, axis: .vertical)
                        .lineLimit(3...8)
                    
                    HStack {
                        Spacer()
                        Text("\(messageBody.count) / 160 characters")
                            .font(.caption2)
                            .foregroundColor(messageBody.count > 160 ? AppColors.rose : .secondary)
                    }
                }
                
                if let err = errorMessage {
                    Section {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(AppColors.rose)
                    }
                }
            }
            .navigationTitle("New SMS Message")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        sendMessage()
                    }
                    .disabled(selectedDid.isEmpty || recipientPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || messageBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                    .font(.headline.bold())
                }
            }
            .onAppear {
                if let to = prefillTo, recipientPhone.isEmpty {
                    recipientPhone = to
                }
                if selectedDid.isEmpty {
                    selectedDid = matchedDid() ?? messagesVM.dids.first?.did ?? ""
                }
            }
        }
    }
    
    private func matchedDid() -> String? {
        let slug = (prefillSiteSlug ?? "").lowercased()
        let siteName = (prefillSiteName ?? "").lowercased()
        let slugTokens = slug.split(separator: "-").map(String.init).filter { $0.count > 2 }
        
        for did in messagesVM.dids {
            let hay = "\(did.label) \(did.description) \(did.subAccount) \(did.formatted)".lowercased()
            if !slug.isEmpty, hay.contains(slug.replacingOccurrences(of: "-", with: " ")) {
                return did.did
            }
            if !siteName.isEmpty, hay.contains(siteName) {
                return did.did
            }
            for token in slugTokens where hay.contains(token) {
                return did.did
            }
        }
        return nil
    }
    
    private func sendMessage() {
        isSending = true
        errorMessage = nil
        let to = recipientPhone.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
        
        Task {
            let success = await messagesVM.composeNewSMS(fromDid: selectedDid, toContact: to, messageText: body)
            if success {
                dismiss()
            } else {
                errorMessage = "Failed to send SMS message. Please check number and connection."
            }
            isSending = false
        }
    }
}
