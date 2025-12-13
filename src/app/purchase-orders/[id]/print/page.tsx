"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PrintPurchaseOrderPage() {
    const params = useParams();
    const id = params.id as string;
    const [po, setPo] = useState<any>(null);

    useEffect(() => {
        fetch(`/api/purchase-orders/${id}`)
            .then(res => res.json())
            .then(data => {
                setPo(data);
            })
            .catch(console.error);
    }, [id]);

    if (!po) return <div className="p-8">Loading...</div>;

    const total = po.items.reduce((sum: number, i: any) => sum + (i.qty * i.pricePerUnit), 0);

    return (
        <div className="p-8 max-w-[210mm] mx-auto bg-white min-h-screen text-black print:p-0">
            <div className="flex justify-between items-start mb-8 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-gray-900">Purchase Order</h1>
                    <div className="text-gray-600">PO #: {po.id}</div>
                    <div className="text-gray-600">Date: {new Date(po.createdAt).toLocaleDateString()}</div>
                    <div className="text-gray-600 mt-1 uppercase font-bold text-sm tracking-wide">{po.status}</div>
                </div>
                <div className="text-right">
                    <h2 className="font-bold text-xl text-gray-900">{po.supplier.name}</h2>
                    {po.supplier.phone && <div className="text-gray-600">{po.supplier.phone}</div>}
                    {po.supplier.address && <div className="text-gray-600 whitespace-pre-line max-w-xs ml-auto">{po.supplier.address}</div>}
                </div>
            </div>

            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b-2 border-black">
                        <th className="text-left py-2 font-bold text-gray-900">Item</th>
                        <th className="text-right py-2 font-bold text-gray-900">Qty</th>
                        <th className="text-right py-2 font-bold text-gray-900">Unit Price</th>
                        <th className="text-right py-2 font-bold text-gray-900">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {po.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-200">
                            <td className="py-2 text-gray-900">{item.item?.name || "Unknown Item"}</td>
                            <td className="text-right py-2 text-gray-900">{item.qty}</td>
                            <td className="text-right py-2 text-gray-900">${parseFloat(item.pricePerUnit).toFixed(2)}</td>
                            <td className="text-right py-2 text-gray-900">${(item.qty * item.pricePerUnit).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={3} className="pt-4 text-right font-bold text-gray-900 text-lg">Total Amount:</td>
                        <td className="pt-4 text-right font-bold text-gray-900 text-lg">${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            {(po.notes || po.terms) && (
                <div className="grid grid-cols-2 gap-8 mt-12 border-t border-gray-200 pt-8">
                    {po.notes && (
                        <div>
                            <h3 className="font-bold mb-2 text-gray-900 uppercase text-sm tracking-wide">Notes</h3>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{po.notes}</p>
                        </div>
                    )}
                    {po.terms && (
                        <div>
                            <h3 className="font-bold mb-2 text-gray-900 uppercase text-sm tracking-wide">Terms & Conditions</h3>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{po.terms}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 text-center print:hidden space-x-4">
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors"
                >
                    Print Purchase Order
                </button>
                <button
                    onClick={() => window.close()}
                    className="text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
