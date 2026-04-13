import pickle

def load_model():
    with open("model.pkl", "rb") as f:
        return pickle.load(f)

def predict(model, features):
    return model.predict(features)