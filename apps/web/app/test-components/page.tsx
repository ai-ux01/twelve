'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartViewerTest } from '@/components/ChartViewer.test';

export default function TestComponentsPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">shadcn/ui Component Showcase</h1>

      {/* ChartViewer Component Test */}
      <div className="mb-8">
        <ChartViewerTest />
      </div>

      {/* Button Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Button Components</CardTitle>
          <CardDescription>All button variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
        </CardContent>
      </Card>

      {/* Input Component */}
      <Card>
        <CardHeader>
          <CardTitle>Input Component</CardTitle>
          <CardDescription>Text input field</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Enter your prompt here..." />
          <Input placeholder="Search symbols..." disabled />
        </CardContent>
      </Card>

      {/* Card Component */}
      <Card>
        <CardHeader>
          <CardTitle>Card Component</CardTitle>
          <CardDescription>Card with header, content, and footer</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is an example of a card component with multiple sections. Perfect for displaying
            trade recommendations and portfolio information.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm">Execute Trade</Button>
        </CardFooter>
      </Card>

      {/* Dialog Component */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog Component</CardTitle>
          <CardDescription>Modal dialog with confirmation flow</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger>
              <Button>Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Live Trade</DialogTitle>
                <DialogDescription>
                  Are you sure you want to execute this trade? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Symbol:</span>
                  <span className="text-sm font-medium">RELIANCE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Action:</span>
                  <span className="text-sm font-medium text-profit">BUY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Quantity:</span>
                  <span className="text-sm font-medium">10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entry Price:</span>
                  <span className="text-sm font-medium">₹2,460</span>
                </div>
              </div>
              <DialogFooter showCloseButton>
                <Button>Confirm Trade</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Table Component */}
      <Card>
        <CardHeader>
          <CardTitle>Table Component</CardTitle>
          <CardDescription>Portfolio positions table</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Current open positions</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Current</TableHead>
                <TableHead className="text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">RELIANCE</TableCell>
                <TableCell>10</TableCell>
                <TableCell>₹2,450</TableCell>
                <TableCell>₹2,480</TableCell>
                <TableCell className="text-right text-profit font-medium">+₹300 (1.22%)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">TCS</TableCell>
                <TableCell>5</TableCell>
                <TableCell>₹3,520</TableCell>
                <TableCell>₹3,495</TableCell>
                <TableCell className="text-right text-loss font-medium">-₹125 (-0.71%)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INFY</TableCell>
                <TableCell>15</TableCell>
                <TableCell>₹1,450</TableCell>
                <TableCell>₹1,465</TableCell>
                <TableCell className="text-right text-profit font-medium">+₹225 (1.03%)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Trading-specific colors showcase */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Theme Colors</CardTitle>
          <CardDescription>Custom profit and loss color scheme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="bg-profit h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Profit
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-profit</p>
            </div>
            <div className="flex-1">
              <div className="bg-profit-light h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Profit Light
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-profit-light</p>
            </div>
            <div className="flex-1">
              <div className="bg-profit-dark h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Profit Dark
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-profit-dark</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="bg-loss h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Loss
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-loss</p>
            </div>
            <div className="flex-1">
              <div className="bg-loss-light h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Loss Light
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-loss-light</p>
            </div>
            <div className="flex-1">
              <div className="bg-loss-dark h-12 rounded-lg flex items-center justify-center text-white font-medium">
                Loss Dark
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">bg-loss-dark</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
