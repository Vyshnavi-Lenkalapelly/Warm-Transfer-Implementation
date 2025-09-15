from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.agent import Agent
import logging

logger = logging.getLogger(__name__)

def create_default_agents():
    """Create default agents for testing"""
    db = next(get_db())
    
    try:
        # Check if agents already exist
        existing_agents = db.query(Agent).count()
        if existing_agents > 0:
            logger.info(f"✅ Found {existing_agents} existing agents")
            return
        
        # Create default agents
        default_agents = [
            {
                "agent_id": "agent-001",
                "name": "Sarah Johnson",
                "email": "sarah.johnson@company.com",
                "department": "Customer Support",
                "skills": ["Customer Support", "General Inquiries"],
                "is_available": True,
                "status": "online",
                "max_concurrent_calls": 3,
                "current_calls": 0
            },
            {
                "agent_id": "agent-002", 
                "name": "Mike Chen",
                "email": "mike.chen@company.com",
                "department": "Technical Support",
                "skills": ["Technical Support", "Troubleshooting"],
                "is_available": True,
                "status": "online",
                "max_concurrent_calls": 2,
                "current_calls": 0
            },
            {
                "agent_id": "agent-003",
                "name": "Lisa Williams", 
                "email": "lisa.williams@company.com",
                "department": "Billing",
                "skills": ["Billing", "Account Management"],
                "is_available": True,
                "status": "online",
                "max_concurrent_calls": 3,
                "current_calls": 0
            },
            {
                "agent_id": "agent-004",
                "name": "David Rodriguez",
                "email": "david.rodriguez@company.com", 
                "department": "Sales",
                "skills": ["Sales", "Product Demo"],
                "is_available": True,
                "status": "online",
                "max_concurrent_calls": 2,
                "current_calls": 0
            }
        ]
        
        for agent_data in default_agents:
            agent = Agent(**agent_data)
            db.add(agent)
        
        db.commit()
        logger.info(f"✅ Created {len(default_agents)} default agents")
        
    except Exception as e:
        logger.error(f"❌ Failed to create default agents: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_agents()