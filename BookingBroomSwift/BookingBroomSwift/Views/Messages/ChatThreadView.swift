import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

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
                    LazyVStack(spacing: 6) {
                        ForEach(liveThread.messages) { msg in
                            MessageBubble(message: msg)
                                .id(msg.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                }
                .scrollDismissesKeyboard(.interactively)
                .background(AppColors.groupedBackground.ignoresSafeArea())
                .onChange(of: liveThread.messages.count) { _, _ in
                    scrollToBottom(proxy: proxy)
                }
                .onAppear {
                    scrollToBottom(proxy: proxy)
                }
            }

            BBComposerBar(
                text: $messagesVM.draftText,
                placeholder: "Text Message",
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
        .toolbar(.hidden, for: .tabBar)
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

    /// iMessage blue for outbound; system gray for inbound.
    private var bubbleFill: Color {
        if isOutbound {
            return Color(red: 0.0, green: 0.478, blue: 1.0) // #007AFF
        }
        #if os(iOS)
        return Color(uiColor: .systemGray5)
        #else
        return Color.secondary.opacity(0.18)
        #endif
    }

    private var mediaUrls: [String] {
        message.mediaUrls ?? []
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isOutbound { Spacer(minLength: 48) }

            VStack(alignment: isOutbound ? .trailing : .leading, spacing: 4) {
                if !mediaUrls.isEmpty {
                    VStack(alignment: isOutbound ? .trailing : .leading, spacing: 4) {
                        ForEach(mediaUrls, id: \.self) { urlString in
                            MMSThumbnail(urlString: urlString)
                        }
                    }
                }

                if !message.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(message.body)
                        .font(.body)
                        .foregroundStyle(isOutbound ? Color.white : Color.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(bubbleFill)
                        .clipShape(BubbleShape(isOutbound: isOutbound))
                }

                Text(message.sentAt, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            }
            .frame(maxWidth: 280, alignment: isOutbound ? .trailing : .leading)

            if !isOutbound { Spacer(minLength: 48) }
        }
    }
}

private struct BubbleShape: Shape {
    var isOutbound: Bool

    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 18
        let tail: CGFloat = 4
        var path = Path()
        if isOutbound {
            path.addRoundedRect(
                in: CGRect(x: 0, y: 0, width: rect.width - tail, height: rect.height),
                cornerSize: CGSize(width: r, height: r)
            )
        } else {
            path.addRoundedRect(
                in: CGRect(x: tail, y: 0, width: rect.width - tail, height: rect.height),
                cornerSize: CGSize(width: r, height: r)
            )
        }
        return path
    }
}

private struct MMSThumbnail: View {
    let urlString: String

    var body: some View {
        if let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(maxWidth: 220, maxHeight: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                case .failure:
                    placeholder
                case .empty:
                    ProgressView()
                        .frame(width: 120, height: 120)
                @unknown default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Color.secondary.opacity(0.15))
            .frame(width: 120, height: 120)
            .overlay {
                Image(systemName: "photo")
                    .foregroundStyle(.secondary)
            }
    }
}
