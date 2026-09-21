import SwiftUI

public struct ChatThreadView: View {
    public let thread: ChatThread
    @Bindable var messagesVM: MessagesViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(AppController.self) private var appController: AppController?
    @State private var showingAIWand = false
    @State private var showingDeleteAlert = false
    
    public init(thread: ChatThread, messagesVM: MessagesViewModel) {
        self.thread = thread
        self.messagesVM = messagesVM
    }
    
    private var liveThread: ChatThread {
        messagesVM.threads.first(where: { $0.id == thread.id }) ?? thread
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: AppSpacing.xs) {
                        ForEach(liveThread.messages) { msg in
                            MessageBubble(message: msg)
                                .id(msg.id)
                        }
                    }
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                }
                .background(AppColors.groupedBackground.ignoresSafeArea())
                .onChange(of: liveThread.messages.count) { _, _ in
                    scrollToBottom(proxy: proxy)
                }
                .onAppear {
                    scrollToBottom(proxy: proxy)
                }
            }
            
            Divider()
            
            BBComposerBar(
                text: $messagesVM.draftText,
                placeholder: "Message",
                leadingSystemImage: "wand.and.stars",
                leadingTint: AppColors.violet,
                leadingHelp: "AI Wand",
                onLeading: { showingAIWand = true },
                onSend: {
                    messagesVM.sendMessage(did: thread.did, contact: thread.contact)
                }
            )
        }
        .navigationTitle(liveThread.contactName ?? liveThread.contact)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(role: .destructive) {
                    showingDeleteAlert = true
                } label: {
                    Image(systemName: "trash")
                }
                .tint(AppColors.rose)
            }
        }
        .alert("Delete SMS conversation?", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                messagesVM.deleteConversation(did: thread.did, contact: thread.contact)
                dismiss()
            }
        } message: {
            Text("All messages in this thread will be permanently removed from Booking Broom.")
        }
        .sheet(isPresented: $showingAIWand) {
            AIWandModal(messagesVM: messagesVM, siteName: siteName)
        }
        .onAppear {
            // Cached 60 s — push/pop of this screen doesn't refetch history.
            messagesVM.loadThreadMessages(did: thread.did, contact: thread.contact)
        }
    }
    
    /// Site that owns this DID (via `sms:listDids.site_id` → bookings' sites), else a neutral name.
    private var siteName: String {
        if let siteId = messagesVM.siteId(forDid: thread.did),
           let site = appController?.bookingsVM.sites.first(where: { $0.id == siteId }) {
            return site.name
        }
        if let did = messagesVM.dids.first(where: { $0.did == thread.did }), !did.description.isEmpty {
            return did.description
        }
        return "our team"
    }
    
    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let last = liveThread.messages.last {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}

struct MessageBubble: View {
    let message: SMSMessage
    
    private var isOutbound: Bool {
        message.direction == .out
    }
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isOutbound { Spacer(minLength: 56) }
            
            VStack(alignment: isOutbound ? .trailing : .leading, spacing: 3) {
                Text(message.body)
                    .font(AppTypography.body)
                    .foregroundStyle(isOutbound ? Color.white : Color.primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isOutbound ? AppColors.primary : AppColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.composerRadius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: ControlMetrics.composerRadius, style: .continuous)
                            .stroke(isOutbound ? Color.clear : AppColors.separator.opacity(0.45), lineWidth: 1)
                    )
                
                Text(message.sentAt, style: .time)
                    .font(AppTypography.micro)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            }
            .frame(maxWidth: 280, alignment: isOutbound ? .trailing : .leading)
            
            if !isOutbound { Spacer(minLength: 56) }
        }
    }
}
