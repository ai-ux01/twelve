'use client';

/**
 * KotakOrdersPanel Component
 *
 * Shows live order book from Kotak Neo with Cancel and Modify actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { kotakApi } from '@/lib/kotak-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, X, Edit2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Order {
  nOrdNo: string;
  trdSym: string;
  qty: number;
  prc: string;
  avgPrc: string;
  trnsTp: string;
  prcTp: string;
  ordSt: string;
  prod: string;
  exSeg: string;
  vldt: string;
  ordGenTp?: string;
  rejRsn?: string;
  ordDtTm?: string;
}

export function KotakOrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modify dialog state
  const [modifyOrder, setModifyOrder] = useState<Order | null>(null);
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifyQty, setModifyQty] = useState('');
  const [isModifying, setIsModifying] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!kotakApi.getSessionId()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await kotakApi.getOrders();
      const data = res?.data || res || [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancel = async (order: Order) => {
    const isAmo = order.ordGenTp === 'AMO' || order.ordSt?.includes('after market');
    const confirmed = window.confirm(`Cancel order ${order.nOrdNo} for ${order.trdSym}?`);
    if (!confirmed) return;

    setError(null);
    setSuccessMsg(null);
    try {
      const jData: any = { on: order.nOrdNo };
      if (isAmo) {
        jData.am = 'YES';
        jData.ts = order.trdSym;
      } else {
        jData.am = 'NO';
      }
      const res = await kotakApi.cancelOrder(jData);
      if (res?.stat === 'Ok') {
        setSuccessMsg(`Order ${order.nOrdNo} cancelled successfully`);
        fetchOrders();
      } else {
        setError(res?.emsg || 'Cancel failed');
      }
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    }
  };

  const openModifyDialog = (order: Order) => {
    setModifyOrder(order);
    setModifyPrice(order.prc || '0');
    setModifyQty(String(order.qty || 1));
    setError(null);
  };

  const handleModify = async () => {
    if (!modifyOrder) return;
    setIsModifying(true);
    setError(null);
    setSuccessMsg(null);

    const isAmo = modifyOrder.ordGenTp === 'AMO' || modifyOrder.ordSt?.includes('after market');
    try {
      const jData: any = {
        no: modifyOrder.nOrdNo,
        es: modifyOrder.exSeg || 'nse_cm',
        ts: modifyOrder.trdSym,
        tt: modifyOrder.trnsTp,
        pt: modifyOrder.prcTp || 'L',
        pc: modifyOrder.prod || 'CNC',
        pr: modifyPrice,
        qt: modifyQty,
        dq: '0',
        mp: '0',
        tp: '0',
        rt: modifyOrder.vldt || 'DAY',
        am: isAmo ? 'YES' : 'NO',
        pf: 'N',
      };

      const res = await kotakApi.modifyOrder(jData);
      if (res?.stat === 'Ok' || res?.nOrdNo) {
        setSuccessMsg(`Order ${modifyOrder.nOrdNo} modified successfully`);
        setModifyOrder(null);
        fetchOrders();
      } else {
        setError(res?.emsg || 'Modify failed');
      }
    } catch (err: any) {
      setError(err.message || 'Modify failed');
    } finally {
      setIsModifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status?.includes('executed') || status?.includes('complete'))
      return <Badge className="bg-green-600 text-xs">Executed</Badge>;
    if (status?.includes('rejected'))
      return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
    if (status?.includes('cancelled'))
      return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
    if (status?.includes('open') || status?.includes('pending'))
      return <Badge className="bg-blue-600 text-xs">Open</Badge>;
    if (status?.includes('after market'))
      return <Badge className="bg-amber-600 text-xs">AMO</Badge>;
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  // Separate orders into active and cancelled
  const activeOrders = orders.filter((o) => !o.ordSt?.includes('cancelled'));
  const cancelledOrders = orders.filter((o) => o.ordSt?.includes('cancelled'));

  const [activeTab, setActiveTab] = useState<'active' | 'cancelled'>('active');

  if (!kotakApi.getSessionId()) return null;

  const renderOrderTable = (orderList: Order[], showActions: boolean) => {
    if (orderList.length === 0 && !isLoading) {
      return <div className="p-6 text-center text-muted-foreground">No orders</div>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Symbol</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Qty</th>
              <th className="text-right p-3 font-medium">Price</th>
              <th className="text-left p-3 font-medium">Product</th>
              {showActions && <th className="text-right p-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orderList.map((o) => {
              const canModify = o.ordSt?.includes('open') || o.ordSt?.includes('pending') || o.ordSt?.includes('after market');
              return (
                <tr key={o.nOrdNo} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    {o.trdSym}
                    <span className={`ml-2 text-xs ${o.trnsTp === 'B' ? 'text-green-600' : 'text-red-600'}`}>
                      {o.trnsTp === 'B' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{o.prcTp === 'MKT' ? 'Market' : o.prcTp === 'L' ? 'Limit' : o.prcTp}</td>
                  <td className="p-3">{getStatusBadge(o.ordSt)}</td>
                  <td className="p-3 text-right">{o.qty}</td>
                  <td className="p-3 text-right">₹{parseFloat(o.prc || '0').toFixed(2)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">{o.prod}</Badge>
                  </td>
                  {showActions && (
                    <td className="p-3 text-right">
                      {canModify && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModifyDialog(o)}
                            className="h-7 px-2"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(o)}
                            className="h-7 px-2 text-red-600 hover:text-red-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-xl font-semibold">Order Book</h2>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'active'
              ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('active')}
        >
          Active ({activeOrders.length})
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'cancelled'
              ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled ({cancelledOrders.length})
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="mx-6 mt-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      {activeTab === 'active' && renderOrderTable(activeOrders, true)}
      {activeTab === 'cancelled' && renderOrderTable(cancelledOrders, false)}

      {/* Modify Dialog */}
      <Dialog open={!!modifyOrder} onOpenChange={(open) => !open && setModifyOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Order</DialogTitle>
            <DialogDescription>
              {modifyOrder?.trdSym} — Order #{modifyOrder?.nOrdNo}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Price</label>
              <Input
                type="number"
                step="0.05"
                value={modifyPrice}
                onChange={(e) => setModifyPrice(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="1"
                value={modifyQty}
                onChange={(e) => setModifyQty(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyOrder(null)}>Cancel</Button>
            <Button onClick={handleModify} disabled={isModifying}>
              {isModifying ? 'Modifying...' : 'Modify Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
