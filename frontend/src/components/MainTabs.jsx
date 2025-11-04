import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { LayoutDashboard, TrendingUp, Users } from 'lucide-react';

export function MainTabs({ children }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="border-b bg-background">
        <div className="container mx-auto px-4">
          <TabsList className="h-12 bg-transparent border-0 gap-4">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="font-medium">개요</span>
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">성과 분석</span>
            </TabsTrigger>
            <TabsTrigger 
              value="audience" 
              className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Users className="h-4 w-4" />
              <span className="font-medium">고객 분석</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {children}
    </Tabs>
  );
}

export function OverviewTab({ children }) {
  return (
    <TabsContent value="overview" className="mt-6">
      {children}
    </TabsContent>
  );
}

export function PerformanceTab({ children }) {
  return (
    <TabsContent value="performance" className="mt-6">
      {children}
    </TabsContent>
  );
}

export function AudienceTab({ children }) {
  return (
    <TabsContent value="audience" className="mt-6">
      {children}
    </TabsContent>
  );
}

