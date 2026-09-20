import SwiftUI
import MapKit
#if os(iOS)
import UIKit
#endif

public struct MapPreview: View {
    public let address: String
    public let coordinate: CLLocationCoordinate2D
    
    @State private var position: MapCameraPosition
    
    public init(address: String, coordinate: CLLocationCoordinate2D) {
        self.address = address
        self.coordinate = coordinate
        _position = State(initialValue: .region(
            MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
            )
        ))
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Map(position: $position) {
                Marker(address, systemImage: "house.fill", coordinate: coordinate)
                    .tint(AppColors.primary)
            }
            .frame(height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            
            HStack {
                Image(systemName: "mappin.circle.fill")
                    .foregroundColor(AppColors.rose)
                Text(address)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Spacer()
                Menu {
                    Button {
                        openInAppleMaps()
                    } label: {
                        Label("Apple Maps", systemImage: "map")
                    }
                    Button {
                        openInGoogleMaps()
                    } label: {
                        Label("Google Maps", systemImage: "globe")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text("Directions")
                            .font(.caption.bold())
                        Image(systemName: "arrow.triangle.turn.up.right.circle.fill")
                    }
                    .foregroundColor(AppColors.primary)
                }
            }
        }
    }
    
    private func openInAppleMaps() {
        let placemark = MKPlacemark(coordinate: coordinate)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = address
        mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }
    
    private func openInGoogleMaps() {
        let lat = coordinate.latitude
        let lng = coordinate.longitude
        let encodedAddress = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        
        #if os(iOS)
        if let appURL = URL(string: "comgooglemaps://?daddr=\(lat),\(lng)&directionsmode=driving"),
           UIApplication.shared.canOpenURL(appURL) {
            PlatformOpenURL.open(appURL)
            return
        }
        #endif
        
        if let webURL = URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(lat),\(lng)&travelmode=driving") {
            PlatformOpenURL.open(webURL)
            return
        }
        
        if let fallback = URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(encodedAddress)") {
            PlatformOpenURL.open(fallback)
        }
    }
}
