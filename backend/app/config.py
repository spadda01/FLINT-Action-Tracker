
import os


def get_data_source():
    source = os.getenv("FLINT_DATA_SOURCE", "mock").lower()

    if source != "mock":
        raise ValueError(
            "Only mock data is supported right now. "
            "Real FLINT integration is not configured."
        )

    return source

