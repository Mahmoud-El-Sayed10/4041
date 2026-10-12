"""Use an explicit migration-owner connection; never a browser-supplied URL."""
import os

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url


def database_url():
    value = os.environ.get("DATABASE_URL")
    if not value:
        raise RuntimeError("Set DATABASE_URL to a PostgreSQL migration-owner URL.")
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError("These migrations require PostgreSQL.")
    return url.set(drivername="postgresql+psycopg")


if context.is_offline_mode():
    context.configure(
        url=database_url(), literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
