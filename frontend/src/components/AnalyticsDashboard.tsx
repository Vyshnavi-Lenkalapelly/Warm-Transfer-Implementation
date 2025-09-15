"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Phone, 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Calendar,
  User
} from 'lucide-react';

interface AnalyticsData {
  callVolume: {
    daily: Array<{ date: string; calls: number; transfers: number }>;
    hourly: Array<{ hour: string; calls: number }>;
  };
  agentPerformance: Array<{
    agentId: string;
    name: string;
    callsHandled: number;
    averageCallTime: number;
    transfersReceived: number;
    customerSatisfaction: number;
  }>;
  transferMetrics: {
    warmTransfers: number;
    coldTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
  };
  customerSatisfaction: Array<{
    date: string;
    rating: number;
  }>;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  format?: 'number' | 'percentage' | 'time';
}

function MetricCard({ title, value, change, icon, format = 'number' }: MetricCardProps) {
  const isPositive = change > 0;
  const formatValue = (val: string | number) => {
    if (format === 'percentage') return `${val}%`;
    if (format === 'time') return `${val}m`;
    return val.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatValue(value)}</p>
          <div className={`flex items-center mt-2 text-sm ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4 mr-1" />
            ) : (
              <ArrowDownRight className="w-4 h-4 mr-1" />
            )}
            {Math.abs(change)}% from last period
          </div>
        </div>
        <div className="text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock analytics data
    const mockData: AnalyticsData = {
      callVolume: {
        daily: [
          { date: '2024-01-01', calls: 145, transfers: 23 },
          { date: '2024-01-02', calls: 132, transfers: 19 },
          { date: '2024-01-03', calls: 178, transfers: 31 },
          { date: '2024-01-04', calls: 156, transfers: 25 },
          { date: '2024-01-05', calls: 189, transfers: 28 },
          { date: '2024-01-06', calls: 134, transfers: 22 },
          { date: '2024-01-07', calls: 167, transfers: 26 }
        ],
        hourly: [
          { hour: '9:00', calls: 12 },
          { hour: '10:00', calls: 18 },
          { hour: '11:00', calls: 24 },
          { hour: '12:00', calls: 19 },
          { hour: '13:00', calls: 15 },
          { hour: '14:00', calls: 22 },
          { hour: '15:00', calls: 28 },
          { hour: '16:00', calls: 31 },
          { hour: '17:00', calls: 25 }
        ]
      },
      agentPerformance: [
        {
          agentId: '1',
          name: 'Sarah Johnson',
          callsHandled: 45,
          averageCallTime: 8.5,
          transfersReceived: 12,
          customerSatisfaction: 4.8
        },
        {
          agentId: '2',
          name: 'Mike Chen',
          callsHandled: 52,
          averageCallTime: 7.2,
          transfersReceived: 8,
          customerSatisfaction: 4.9
        },
        {
          agentId: '3',
          name: 'Emily Rodriguez',
          callsHandled: 38,
          averageCallTime: 9.1,
          transfersReceived: 15,
          customerSatisfaction: 4.7
        }
      ],
      transferMetrics: {
        warmTransfers: 89,
        coldTransfers: 23,
        successfulTransfers: 98,
        failedTransfers: 14
      },
      customerSatisfaction: [
        { date: '2024-01-01', rating: 4.2 },
        { date: '2024-01-02', rating: 4.5 },
        { date: '2024-01-03', rating: 4.3 },
        { date: '2024-01-04', rating: 4.7 },
        { date: '2024-01-05', rating: 4.8 },
        { date: '2024-01-06', rating: 4.6 },
        { date: '2024-01-07', rating: 4.9 }
      ]
    };

    setTimeout(() => {
      setAnalyticsData(mockData);
      setIsLoading(false);
    }, 1000);
  }, [selectedTimeRange]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) return null;

  const transferData = [
    { name: 'Warm Transfers', value: analyticsData.transferMetrics.warmTransfers },
    { name: 'Cold Transfers', value: analyticsData.transferMetrics.coldTransfers }
  ];

  const successData = [
    { name: 'Successful', value: analyticsData.transferMetrics.successfulTransfers },
    { name: 'Failed', value: analyticsData.transferMetrics.failedTransfers }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor call center performance and transfer metrics</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Calls"
          value={1201}
          change={12.5}
          icon={<Phone className="w-8 h-8" />}
        />
        
        <MetricCard
          title="Total Transfers"
          value={234}
          change={8.3}
          icon={<Users className="w-8 h-8" />}
        />
        
        <MetricCard
          title="Avg Call Duration"
          value={8.2}
          change={-2.1}
          icon={<Clock className="w-8 h-8" />}
          format="time"
        />
        
        <MetricCard
          title="Customer Satisfaction"
          value={4.7}
          change={5.2}
          icon={<Star className="w-8 h-8" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Call Volume</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.callVolume.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="#3B82F6" name="Total Calls" />
              <Bar dataKey="transfers" fill="#10B981" name="Transfers" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hourly Call Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.callVolume.hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="calls" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transfer Types */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Types</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={transferData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {transferData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Success Rate</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={successData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {successData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index + 2]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Agent Performance</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Calls Handled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Call Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transfers Received
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Satisfaction
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.agentPerformance.map((agent) => (
                <tr key={agent.agentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.callsHandled}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.averageCallTime}m
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.transfersReceived}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm text-gray-900">{agent.customerSatisfaction}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Satisfaction Trend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Satisfaction Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.customerSatisfaction}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 5]} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="rating" 
              stroke="#F59E0B" 
              strokeWidth={3}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;