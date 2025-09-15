from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.call import Call
from app.models.agent import Agent
from app.models.transfer import Transfer
from app.services.livekit_service import LiveKitService
from app.core.websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter()

# Global services
livekit_service = LiveKitService()
connection_manager = ConnectionManager()

# Pydantic models
class AnalyticsTimeframe(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    period: Optional[str] = "daily"  # hourly, daily, weekly, monthly

@router.get("/dashboard")
async def get_dashboard_analytics(
    timeframe: str = "24h",  # 1h, 24h, 7d, 30d
    db: Session = Depends(get_db)
):
    """Get dashboard analytics for specified timeframe"""
    try:
        # Calculate time range
        now = datetime.utcnow()
        if timeframe == "1h":
            start_time = now - timedelta(hours=1)
        elif timeframe == "24h":
            start_time = now - timedelta(hours=24)
        elif timeframe == "7d":
            start_time = now - timedelta(days=7)
        elif timeframe == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(hours=24)
        
        # Call metrics
        total_calls = db.query(Call).filter(Call.created_at >= start_time).count()
        active_calls = db.query(Call).filter(
            Call.status.in_(["initiated", "active"]),
            Call.created_at >= start_time
        ).count()
        completed_calls = db.query(Call).filter(
            Call.status == "ended",
            Call.created_at >= start_time
        ).count()
        
        # Average call duration
        avg_duration = db.query(func.avg(Call.duration_seconds)).filter(
            Call.status == "ended",
            Call.created_at >= start_time,
            Call.duration_seconds.isnot(None)
        ).scalar() or 0
        
        # Transfer metrics
        total_transfers = db.query(Transfer).filter(Transfer.created_at >= start_time).count()
        successful_transfers = db.query(Transfer).filter(
            Transfer.was_successful == True,
            Transfer.created_at >= start_time
        ).count()
        transfer_success_rate = (successful_transfers / total_transfers * 100) if total_transfers > 0 else 0
        
        # Agent metrics
        total_agents = db.query(Agent).count()
        online_agents = db.query(Agent).filter(Agent.status == "online").count()
        available_agents = db.query(Agent).filter(
            Agent.is_available == True,
            Agent.status == "online"
        ).count()
        
        # System metrics
        livekit_health = await livekit_service.health_check()
        connection_stats = connection_manager.get_connection_stats()
        
        # Calculate trends (comparing to previous period)
        previous_start = start_time - (now - start_time)
        previous_calls = db.query(Call).filter(
            Call.created_at >= previous_start,
            Call.created_at < start_time
        ).count()
        call_trend = ((total_calls - previous_calls) / previous_calls * 100) if previous_calls > 0 else 0
        
        dashboard_data = {
            "timeframe": timeframe,
            "generated_at": now.isoformat(),
            "calls": {
                "total": total_calls,
                "active": active_calls,
                "completed": completed_calls,
                "average_duration_minutes": round(avg_duration / 60, 2) if avg_duration else 0,
                "trend_percentage": round(call_trend, 1)
            },
            "transfers": {
                "total": total_transfers,
                "successful": successful_transfers,
                "success_rate_percentage": round(transfer_success_rate, 1)
            },
            "agents": {
                "total": total_agents,
                "online": online_agents,
                "available": available_agents,
                "utilization_percentage": round((online_agents / total_agents * 100), 1) if total_agents > 0 else 0
            },
            "system": {
                "livekit_status": livekit_health.get("status", "unknown"),
                "total_rooms": livekit_health.get("total_rooms", 0),
                "websocket_connections": connection_stats["total_connections"],
                "active_rooms": connection_stats["total_rooms"]
            }
        }
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard analytics")

@router.get("/calls")
async def get_call_analytics(
    timeframe: str = "7d",
    group_by: str = "hour",  # hour, day, week
    db: Session = Depends(get_db)
):
    """Get call analytics with time-series data"""
    try:
        # Calculate time range
        now = datetime.utcnow()
        if timeframe == "24h":
            start_time = now - timedelta(hours=24)
        elif timeframe == "7d":
            start_time = now - timedelta(days=7)
        elif timeframe == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(days=7)
        
        # Call volume over time
        if group_by == "hour":
            time_format = func.date_trunc('hour', Call.created_at)
        elif group_by == "day":
            time_format = func.date_trunc('day', Call.created_at)
        else:  # week
            time_format = func.date_trunc('week', Call.created_at)
        
        call_volume = db.query(
            time_format.label('period'),
            func.count(Call.id).label('count')
        ).filter(
            Call.created_at >= start_time
        ).group_by('period').order_by('period').all()
        
        # Call duration distribution
        duration_stats = db.query(
            func.min(Call.duration_seconds).label('min_duration'),
            func.max(Call.duration_seconds).label('max_duration'),
            func.avg(Call.duration_seconds).label('avg_duration'),
            func.percentile_cont(0.5).within_group(Call.duration_seconds).label('median_duration')
        ).filter(
            Call.created_at >= start_time,
            Call.duration_seconds.isnot(None)
        ).first()
        
        # Call status distribution
        status_distribution = db.query(
            Call.status,
            func.count(Call.id).label('count')
        ).filter(
            Call.created_at >= start_time
        ).group_by(Call.status).all()
        
        # Priority distribution
        priority_distribution = db.query(
            Call.priority,
            func.count(Call.id).label('count')
        ).filter(
            Call.created_at >= start_time
        ).group_by(Call.priority).all()
        
        analytics_data = {
            "timeframe": timeframe,
            "group_by": group_by,
            "call_volume": [
                {
                    "period": item.period.isoformat() if item.period else None,
                    "count": item.count
                }
                for item in call_volume
            ],
            "duration_stats": {
                "min_seconds": duration_stats.min_duration or 0,
                "max_seconds": duration_stats.max_duration or 0,
                "avg_seconds": duration_stats.avg_duration or 0,
                "median_seconds": duration_stats.median_duration or 0
            } if duration_stats else {},
            "status_distribution": [
                {"status": item.status, "count": item.count}
                for item in status_distribution
            ],
            "priority_distribution": [
                {"priority": item.priority, "count": item.count}
                for item in priority_distribution
            ]
        }
        
        return analytics_data
        
    except Exception as e:
        logger.error(f"Error getting call analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get call analytics")

@router.get("/agents")
async def get_agent_analytics(
    timeframe: str = "7d",
    db: Session = Depends(get_db)
):
    """Get agent performance analytics"""
    try:
        # Calculate time range
        now = datetime.utcnow()
        if timeframe == "24h":
            start_time = now - timedelta(hours=24)
        elif timeframe == "7d":
            start_time = now - timedelta(days=7)
        elif timeframe == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(days=7)
        
        # Agent performance metrics
        agent_stats = db.query(
            Agent.agent_id,
            Agent.name,
            Agent.status,
            Agent.total_calls_handled,
            Agent.successful_transfers,
            Agent.average_call_duration,
            Agent.customer_satisfaction_rating,
            Agent.current_calls,
            Agent.max_concurrent_calls
        ).all()
        
        # Calculate additional metrics
        agent_performance = []
        for agent in agent_stats:
            transfer_rate = (agent.successful_transfers / agent.total_calls_handled * 100) if agent.total_calls_handled > 0 else 0
            utilization = (agent.current_calls / agent.max_concurrent_calls * 100) if agent.max_concurrent_calls > 0 else 0
            
            agent_data = {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "status": agent.status,
                "total_calls": agent.total_calls_handled,
                "successful_transfers": agent.successful_transfers,
                "transfer_success_rate": round(transfer_rate, 2),
                "average_call_duration": agent.average_call_duration,
                "customer_satisfaction": agent.customer_satisfaction_rating,
                "current_utilization": round(utilization, 2),
                "is_available": agent.status == "online"
            }
            agent_performance.append(agent_data)
        
        # Top performers
        top_by_calls = sorted(agent_performance, key=lambda x: x["total_calls"], reverse=True)[:5]
        top_by_satisfaction = sorted(
            [a for a in agent_performance if a["customer_satisfaction"] > 0],
            key=lambda x: x["customer_satisfaction"],
            reverse=True
        )[:5]
        
        # Agent status distribution
        status_counts = {}
        for agent in agent_performance:
            status = agent["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        analytics_data = {
            "timeframe": timeframe,
            "total_agents": len(agent_performance),
            "agent_performance": agent_performance,
            "top_performers": {
                "by_call_volume": top_by_calls,
                "by_satisfaction": top_by_satisfaction
            },
            "status_distribution": [
                {"status": status, "count": count}
                for status, count in status_counts.items()
            ],
            "summary": {
                "total_calls_handled": sum(a["total_calls"] for a in agent_performance),
                "total_transfers": sum(a["successful_transfers"] for a in agent_performance),
                "average_satisfaction": round(
                    sum(a["customer_satisfaction"] for a in agent_performance if a["customer_satisfaction"] > 0) /
                    len([a for a in agent_performance if a["customer_satisfaction"] > 0]),
                    2
                ) if any(a["customer_satisfaction"] > 0 for a in agent_performance) else 0
            }
        }
        
        return analytics_data
        
    except Exception as e:
        logger.error(f"Error getting agent analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get agent analytics")

@router.get("/transfers")
async def get_transfer_analytics(
    timeframe: str = "7d",
    db: Session = Depends(get_db)
):
    """Get transfer analytics"""
    try:
        # Calculate time range
        now = datetime.utcnow()
        if timeframe == "24h":
            start_time = now - timedelta(hours=24)
        elif timeframe == "7d":
            start_time = now - timedelta(days=7)
        elif timeframe == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(days=7)
        
        # Transfer metrics
        total_transfers = db.query(Transfer).filter(Transfer.created_at >= start_time).count()
        successful_transfers = db.query(Transfer).filter(
            Transfer.was_successful == True,
            Transfer.created_at >= start_time
        ).count()
        failed_transfers = db.query(Transfer).filter(
            Transfer.was_successful == False,
            Transfer.created_at >= start_time
        ).count()
        
        # Average transfer duration
        avg_transfer_duration = db.query(func.avg(Transfer.duration_seconds)).filter(
            Transfer.created_at >= start_time,
            Transfer.duration_seconds.isnot(None)
        ).scalar() or 0
        
        # Transfer status distribution
        status_distribution = db.query(
            Transfer.status,
            func.count(Transfer.id).label('count')
        ).filter(
            Transfer.created_at >= start_time
        ).group_by(Transfer.status).all()
        
        # Transfer type distribution
        type_distribution = db.query(
            Transfer.transfer_type,
            func.count(Transfer.id).label('count')
        ).filter(
            Transfer.created_at >= start_time
        ).group_by(Transfer.transfer_type).all()
        
        # Success rate over time
        success_rate_timeline = db.query(
            func.date_trunc('day', Transfer.created_at).label('day'),
            func.count(Transfer.id).label('total'),
            func.sum(func.cast(Transfer.was_successful, db.Integer)).label('successful')
        ).filter(
            Transfer.created_at >= start_time
        ).group_by('day').order_by('day').all()
        
        analytics_data = {
            "timeframe": timeframe,
            "summary": {
                "total_transfers": total_transfers,
                "successful_transfers": successful_transfers,
                "failed_transfers": failed_transfers,
                "success_rate_percentage": round((successful_transfers / total_transfers * 100), 2) if total_transfers > 0 else 0,
                "average_duration_seconds": round(avg_transfer_duration, 2)
            },
            "status_distribution": [
                {"status": item.status, "count": item.count}
                for item in status_distribution
            ],
            "type_distribution": [
                {"type": item.transfer_type, "count": item.count}
                for item in type_distribution
            ],
            "success_rate_timeline": [
                {
                    "date": item.day.isoformat() if item.day else None,
                    "total_transfers": item.total,
                    "successful_transfers": item.successful or 0,
                    "success_rate": round((item.successful or 0) / item.total * 100, 2) if item.total > 0 else 0
                }
                for item in success_rate_timeline
            ]
        }
        
        return analytics_data
        
    except Exception as e:
        logger.error(f"Error getting transfer analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transfer analytics")

@router.get("/realtime")
async def get_realtime_metrics():
    """Get real-time system metrics"""
    try:
        # LiveKit metrics
        livekit_health = await livekit_service.health_check()
        
        # WebSocket connection metrics
        connection_stats = connection_manager.get_connection_stats()
        
        # Active transfers
        active_transfers = await livekit_service.get_active_transfers()
        
        realtime_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "livekit": {
                "status": livekit_health.get("status", "unknown"),
                "total_rooms": livekit_health.get("total_rooms", 0),
                "active_rooms": livekit_health.get("active_rooms", 0),
                "active_transfers": livekit_health.get("active_transfers", 0)
            },
            "websockets": {
                "total_connections": connection_stats["total_connections"],
                "total_rooms": connection_stats["total_rooms"],
                "total_agents": connection_stats["total_agents"]
            },
            "transfers": {
                "active_count": len(active_transfers),
                "active_transfers": active_transfers
            }
        }
        
        return realtime_data
        
    except Exception as e:
        logger.error(f"Error getting realtime metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get realtime metrics")