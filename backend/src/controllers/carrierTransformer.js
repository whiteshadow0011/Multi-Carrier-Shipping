import { Builder } from 'xml2js';

export const transformToCarrierFormat = (shipmentData, carrier) => {
    const { carrier_code, payload_format } = carrier;

    if (payload_format === 'XML' || carrier_code === 'DHL') {
        const builder = new Builder({ rootName: 'ShipmentOrderRequest' });
        const xmlObj = {
            Header: {
                Carrier: carrier_code,
                MessageId: `MSG-${Date.now()}`,
            },
            Shipper: {
                Name: shipmentData.sender_name,
                Address: shipmentData.sender_address,
            },
            Consignee: {
                Name: shipmentData.receiver_name,
                DestinationCity: shipmentData.destination_city,
                PostalCode: shipmentData.destination_pincode,
            },
            Package: {
                WeightKG: shipmentData.package_weight_kg,
            },
        };
        return {
            contentType: 'application/xml',
            payload: builder.buildObject(xmlObj),
        };
    }

    return {
        contentType: 'application/json',
        payload: {
            carrier: carrier_code,
            shipper: {
                contact: shipmentData.sender_name,
                pickupLocation: shipmentData.sender_address,
            },
            recipient: {
                name: shipmentData.receiver_name,
                city: shipmentData.destination_city,
                pincode: shipmentData.destination_pincode,
            },
            parcel: {
                weight: shipmentData.package_weight_kg,
                unit: 'KG',
            },
        },
    };
};