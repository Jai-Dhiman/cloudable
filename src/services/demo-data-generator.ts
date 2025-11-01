import type {
  CostSummary,
  CostBreakdown,
  AWSResourceInventory,
  AWSResource,
} from '../types/cost-monitor.js';

/**
 * Demo Data Generator
 * Returns realistic dummy data for hackathon demos
 * Provides dummy AWS cost data and resources, but real logic runs on top
 */
export class DemoDataGenerator {
  generateLastWeekCost(): CostSummary {
    const topServices: CostBreakdown[] = [
      {
        service: 'EC2',
        currentWeekCost: 80.24,
        previousWeekCost: 60.00,
        changePercent: 33.7,
        changeAmount: 20.24,
        monthlyProjection: 347.44,
      },
      {
        service: 'RDS',
        currentWeekCost: 50.00,
        previousWeekCost: 40.00,
        changePercent: 25.0,
        changeAmount: 10.00,
        monthlyProjection: 216.50,
      },
      {
        service: 'NAT Gateway',
        currentWeekCost: 32.00,
        previousWeekCost: 32.00,
        changePercent: 0.0,
        changeAmount: 0.00,
        monthlyProjection: 138.56,
      },
      {
        service: 'S3',
        currentWeekCost: 5.00,
        previousWeekCost: 4.00,
        changePercent: 25.0,
        changeAmount: 1.00,
        monthlyProjection: 21.65,
      },
      {
        service: 'CloudWatch',
        currentWeekCost: 3.50,
        previousWeekCost: 3.20,
        changePercent: 9.4,
        changeAmount: 0.30,
        monthlyProjection: 15.16,
      },
    ];

    const totalCurrentWeek = topServices.reduce((sum, s) => sum + s.currentWeekCost, 0);
    const totalPreviousWeek = topServices.reduce((sum, s) => sum + s.previousWeekCost, 0);

    return {
      totalCurrentWeek: 170.74,
      totalPreviousWeek: 139.20,
      totalChangePercent: 22.6,
      totalChangeAmount: 31.54,
      monthlyProjection: 739.30,
      topServices,
      billingPeriodStart: this.getLastWeekStart(),
      billingPeriodEnd: this.getToday(),
    };
  }

  generateHistoricalCosts(weeks: number): CostSummary[] {
    const historicalData: CostSummary[] = [];
    const baseCost = 120.00;
    const growthRate = 1.08;

    for (let i = weeks - 1; i >= 0; i--) {
      const weekCost = baseCost * Math.pow(growthRate, weeks - 1 - i);
      const previousWeekCost = i === weeks - 1 ? weekCost * 0.95 : baseCost * Math.pow(growthRate, weeks - 2 - i);

      const topServices: CostBreakdown[] = [
        {
          service: 'EC2',
          currentWeekCost: weekCost * 0.47,
          previousWeekCost: previousWeekCost * 0.47,
          changePercent: ((weekCost - previousWeekCost) / previousWeekCost) * 100,
          changeAmount: weekCost * 0.47 - previousWeekCost * 0.47,
          monthlyProjection: weekCost * 0.47 * 4.33,
        },
        {
          service: 'RDS',
          currentWeekCost: weekCost * 0.29,
          previousWeekCost: previousWeekCost * 0.29,
          changePercent: ((weekCost - previousWeekCost) / previousWeekCost) * 100,
          changeAmount: weekCost * 0.29 - previousWeekCost * 0.29,
          monthlyProjection: weekCost * 0.29 * 4.33,
        },
        {
          service: 'NAT Gateway',
          currentWeekCost: weekCost * 0.19,
          previousWeekCost: previousWeekCost * 0.19,
          changePercent: 0,
          changeAmount: 0,
          monthlyProjection: weekCost * 0.19 * 4.33,
        },
      ];

      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (i * 7));
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      historicalData.push({
        totalCurrentWeek: Math.round(weekCost * 100) / 100,
        totalPreviousWeek: Math.round(previousWeekCost * 100) / 100,
        totalChangePercent: Math.round(((weekCost - previousWeekCost) / previousWeekCost) * 100 * 10) / 10,
        totalChangeAmount: Math.round((weekCost - previousWeekCost) * 100) / 100,
        monthlyProjection: Math.round(weekCost * 4.33 * 100) / 100,
        topServices,
        billingPeriodStart: startDate.toISOString().split('T')[0],
        billingPeriodEnd: endDate.toISOString().split('T')[0],
      });
    }

    return historicalData;
  }

  generateDemoResourceInventory(deploymentId: string): AWSResourceInventory {
    const resources: AWSResource[] = [
      {
        resourceId: 'i-0123456789abcdef0',
        resourceType: 't3.medium',
        service: 'EC2',
        region: 'us-east-1',
        tags: {
          'cloudable:deployment': deploymentId,
          Name: 'web-server-1',
          Environment: 'production',
        },
        state: 'running',
        createdAt: '2024-10-15T08:30:00Z',
        monthlyCost: 30.37,
        metadata: {
          availabilityZone: 'us-east-1a',
          publicIp: '54.123.45.10',
        },
      },
      {
        resourceId: 'i-0987654321fedcba',
        resourceType: 't3.small',
        service: 'EC2',
        region: 'us-east-1',
        tags: {
          'cloudable:deployment': deploymentId,
          Name: 'api-server-1',
          Environment: 'production',
        },
        state: 'running',
        createdAt: '2024-10-15T08:35:00Z',
        monthlyCost: 15.18,
        metadata: {
          availabilityZone: 'us-east-1b',
          publicIp: '54.123.45.11',
        },
      },
      {
        resourceId: 'demo-db-1',
        resourceType: 'db.t3.small',
        service: 'RDS',
        region: 'us-east-1',
        tags: {
          'cloudable:deployment': deploymentId,
          Name: 'postgres-db',
          Environment: 'production',
        },
        state: 'available',
        createdAt: '2024-10-15T08:40:00Z',
        monthlyCost: 46.36,
        metadata: {
          engine: 'postgres',
          engineVersion: '14.7',
          multiAZ: false,
        },
      },
      {
        resourceId: 'nat-0abc123def456',
        resourceType: 'NAT Gateway',
        service: 'VPC',
        region: 'us-east-1',
        tags: {
          'cloudable:deployment': deploymentId,
          Name: 'main-nat-gateway',
        },
        state: 'available',
        createdAt: '2024-10-15T08:25:00Z',
        monthlyCost: 32.85,
        metadata: {
          vpcId: 'vpc-0abc123',
          subnetId: 'subnet-0abc123',
        },
      },
      {
        resourceId: 'demo-bucket-2024',
        resourceType: 'Bucket',
        service: 'S3',
        region: 'us-east-1',
        tags: {
          'cloudable:deployment': deploymentId,
          Purpose: 'static-assets',
        },
        state: 'available',
        createdAt: '2024-10-15T08:20:00Z',
        monthlyCost: 5.0,
        metadata: {},
      },
    ];

    return {
      deploymentId,
      lastUpdated: new Date().toISOString(),
      resources,
      totalResources: resources.length,
      totalMonthlyCost: resources.reduce((sum, r) => sum + r.monthlyCost, 0),
      resourcesByService: {
        EC2: resources.filter(r => r.service === 'EC2'),
        RDS: resources.filter(r => r.service === 'RDS'),
        VPC: resources.filter(r => r.service === 'VPC'),
        S3: resources.filter(r => r.service === 'S3'),
      },
    };
  }

  private getLastWeekStart(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}
