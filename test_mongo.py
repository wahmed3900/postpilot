from pymongo import MongoClient
from pymongo.server_api import ServerApi

# Replace with your Atlas credentials
uri = "mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.nhs6fqc.mongodb.net/?appName=Cluster0"

client = MongoClient(uri, server_api=ServerApi('1'))

try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)
