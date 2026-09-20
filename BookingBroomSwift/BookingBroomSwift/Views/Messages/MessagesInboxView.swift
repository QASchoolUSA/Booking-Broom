import SwiftUI

public struct MessagesInboxView: View {
    @ObservedObject var messagesVM: MessagesViewModel
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
            .searchable(text: $messagesVM.searchText, prompt: "Search SMS conversations...")
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
                messagesVM.syncVoipms()
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
            .frame(minWidth: 280, idealWidth: 340, maxWidth: 400)
            
            Divider()
            
            if let thread = selectedThread {
                ChatThreadView(thread: thread, messagesVM: messagesVM)
            } else {
                ContentUnavailableView(
                    "No Conversation Selected",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Pick an SMS thread to read and reply.")
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
                        NavigationLink(destination: ChatThreadView(thread: thread, messagesVM: messagesVM)) {
                            threadRow(thread)
                        }
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
                .listStyle(.insetGrouped)
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
            Text("No SMS Conversations")
                .font(AppTypography.sectionTitle)
            Text("Sync Voip.ms to pull messages from your business numbers.")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }
    
    private func threadRow(_ thread: ChatThread) -> some View {
        HStack(spacing: AppSpacing.sm) {
            ContactAvatar(
                title: thread.contactName ?? thread.contact,
                systemImage: "message.fill",
                tint: AppColors.primary,
                size: 40
            )
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(thread.contactName ?? thread.contact)
                        .font(AppTypography.rowTitle)
                    Spacer()
                    Text(thread.lastMessage.sentAt, style: .time)
                        .font(AppTypography.micro)
                        .foregroundStyle(.secondary)
                }
                
                Text(thread.lastMessage.body)
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }
}
