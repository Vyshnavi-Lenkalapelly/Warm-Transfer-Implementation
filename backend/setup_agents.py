import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), 'warmtransfer.db')
print(f"Database path: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if agents table exists and create if not
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            department TEXT,
            skills TEXT,
            is_available BOOLEAN DEFAULT TRUE,
            status TEXT DEFAULT 'online',
            max_concurrent_calls INTEGER DEFAULT 3,
            current_calls INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Check current agents count
    cursor.execute('SELECT COUNT(*) FROM agents')
    count = cursor.fetchone()[0]
    print(f"Current agents count: {count}")
    
    # Create test agents
    agents_data = [
        ('agent-001', 'Sarah Johnson', 'sarah@company.com', '["Customer Support", "General Inquiries"]', True, 'online', 3, 0),
        ('agent-002', 'Mike Chen', 'mike@company.com', '["Technical Support", "Troubleshooting"]', True, 'online', 2, 0),
        ('agent-003', 'Lisa Williams', 'lisa@company.com', '["Billing", "Account Management"]', True, 'online', 3, 0),
        ('agent-004', 'David Rodriguez', 'david@company.com', '["Sales", "Product Demo"]', True, 'online', 2, 0)
    ]
    
    for agent in agents_data:
        cursor.execute("""
            INSERT OR REPLACE INTO agents 
            (agent_id, name, email, skills, is_available, status, max_concurrent_calls, current_calls)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, agent)
    
    conn.commit()
    print(f"✅ Created/updated {len(agents_data)} test agents")
    
    # List all agents
    cursor.execute('SELECT agent_id, name, skills, status, is_available FROM agents')
    agents = cursor.fetchall()
    print("📋 Current agents:")
    for agent in agents:
        status_icon = "🟢" if agent[4] else "🔴"
        skills = agent[2] if agent[2] else "[]"
        print(f"  {status_icon} {agent[1]} ({agent[0]}) - {skills} - {agent[3]}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    conn.close()

print("\n✅ Database setup complete!")