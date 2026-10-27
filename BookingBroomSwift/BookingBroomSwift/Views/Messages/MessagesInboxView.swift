import SwiftUI

public struct MessagesInboxView: View {
    @Bindable var messagesVM: MessagesViewModel
    @State private var selectedThreadId: String?
    #if os(macOS)
    @Environment(\.openWindow) private var openWindow
    #endif

    public init(messagesVM: MessagesViewModel) {
        self.messagesVM = messagesVM
    }

    private var visibleThreads: [ChatThread] {
        let q = messagesVM.searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return messagesVM.threads }
        return messagesVM.threads.filter { thread in
            thread.contact.lowercased().contains(q)
                || (thread.contactName?.lowercased().contains(q) ?? false)
                || thread.lastMessage.body.lowercased().contains(q)
        }
    }

    private var selectedThread: ChatThread? {
        guard let selectedThreadId else { return nil }
        return messagesVM.threads.first { $0.id == selectedThreadId }
    }

    public var body: some View {
        NavigationStack {
            Group {
                #if os(macOS)
                macLayout
                #else
                phoneLayout
                #endif
            }
            .background(AppColors.groupedBackground.ignoresSafeArea())
            .navigationTitle("Messages")
            .searchable(text: $messagesVM.searchText, prompt: "Search conversations")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        messagesVM.showingComposeSheet = true
                    }) {
                        Label("Compose", systemImage: "square.and.pencil")
                    }
                }

                #if os(iOS)
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        messagesVM.syncVoipms()
                    }) {
                        if messagesVM.isSyncingVoipms {
                            ProgressView()
                        } else {
                            Label("Sync", systemImage: "arrow.clockwise")
                        }
                    }
                }
                #endif
            }
            .sheet(isPresented: $messagesVM.showingComposeSheet) {
                ComposeSMSView(messagesVM: messagesVM)
            }
            .refreshable {
                await messagesVM.syncVoipmsAndWait(mode: "auto")
            }
            .onAppear {
                messagesVM.ensureLoaded()
            }
        }
    }

    #if os(macOS)
    private var macLayout: some View {
        HStack(spacing: 0) {
            Group {
                if visibleThreads.isEmpty {
                    emptyState
                } else {
                    List(selection: $selectedThreadId) {
                        ForEach(visibleThreads) { thread in
                            threadRow(thread)
                                .tag(thread.id)
                                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                                .contextMenu {
                                    Button("Open in New Window") {
                                        openWindow(id: "sms-thread", value: thread.id)
                                    }
                                    Button("Delete", role: .destructive) {
                                        if selectedThreadId == thread.id { selectedThreadId = nil }
                                        messagesVM.deleteConversation(did: thread.did, contact: thread.contact)
                                    }
                                }
                        }
                    }
                    .listStyle(.sidebar)
                }
            }
            .frame(minWidth: 300, idealWidth: 360, maxWidth: 420)

            Divider()

            if let thread = selectedThread {
                ChatThreadView(thread: thread, messagesVM: messagesVM)
            } else {
                ContentUnavailableView(
                    "No Conversation Selected",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Pick a thread to read and reply.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    #endif

    private var phoneLayout: some View {
        Group {
            if visibleThreads.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(visibleThreads) { thread in
                        NavigationLink {
                            ChatThreadView(thread: thread, messagesVM: messagesVM)
                        } label: {
                            threadRow(thread)
                        }
                        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                messagesVM.deleteConversation(did: thread.did, contact: thread.contact)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                #if os(iOS)
                .listStyle(.plain)
                #else
                .listStyle(.inset)
                #endif
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: AppSpacing.sm) {
            Spacer()
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No Conversations")
                .font(AppTypography.sectionTitle)
            Text("Pull to refresh or tap Sync to pull Voip.ms messages.")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private func threadRow(_ thread: ChatThread) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .topTrailing) {
                ContactAvatar(
                    title: thread.contactName ?? thread.contact,
                    tint: AppColors.primary,
                    size: 48
                )
                if thread.unreadCount > 0 {
                    Text(thread.unreadCount > 9 ? "9+" : "\(thread.unreadCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(AppColors.primary)
                        .clipShape(Capsule())
                        .offset(x: 6, y: -4)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(thread.contactName ?? formattedPhone(thread.contact))
                        .font(thread.unreadCount > 0 ? AppTypography.rowTitle : AppTypography.metaBold)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(thread.lastMessage.sentAt, style: .time)
                        .font(AppTypography.micro)
                        .foregroundStyle(thread.unreadCount > 0 ? AppColors.primary : .secondary)
                }

                Text(previewText(for: thread))
                    .font(AppTypography.meta)
                    .foregroundStyle(thread.unreadCount > 0 ? .primary : .secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }

    private func previewText(for thread: ChatThread) -> String {
        let body = thread.lastMessage.body.trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty {
            if let urls = thread.lastMessage.mediaUrls, !urls.isEmpty {
                return "Photo"
            }
            return "Message"
        }
        let prefix = thread.lastMessage.direction == .out ? "You: " : ""
        return prefix + body
    }

    private func formattedPhone(_ digits: String) -> String {
        let d = digits.filter(\.isNumber)
        guard d.count == 10 else { return digits }
        let a = d.prefix(3)
        let b = d.dropFirst(3).prefix(3)
        let c = d.suffix(4)
        return "(\(a)) \(b)-\(c)"
    }
}
