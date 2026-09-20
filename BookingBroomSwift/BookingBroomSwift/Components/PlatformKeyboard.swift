import SwiftUI

#if os(iOS)
import UIKit
#endif

extension View {
    /// iOS soft-keyboard type; no-op on macOS.
    @ViewBuilder
    func platformKeyboardType(_ type: PlatformKeyboardType) -> some View {
        #if os(iOS)
        self.keyboardType(type.uiKeyboardType)
        #else
        self
        #endif
    }
    
    @ViewBuilder
    func platformScrollDismissesKeyboard() -> some View {
        #if os(iOS)
        self.scrollDismissesKeyboard(.interactively)
        #else
        self
        #endif
    }
    
    @ViewBuilder
    func platformAutocapitalizationNone() -> some View {
        #if os(iOS)
        self.autocapitalization(.none)
        #else
        self
        #endif
    }
}

enum PlatformKeyboardType {
    case emailAddress
    case phonePad
    case decimalPad
    case numberPad
    case defaultType
    
    #if os(iOS)
    var uiKeyboardType: UIKeyboardType {
        switch self {
        case .emailAddress: return .emailAddress
        case .phonePad: return .phonePad
        case .decimalPad: return .decimalPad
        case .numberPad: return .numberPad
        case .defaultType: return .default
        }
    }
    #endif
}
