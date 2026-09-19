from sqlalchemy import Column, Integer, Float, String
from app.database import Base

class Proyecto(Base):
    __tablename__ = "proyecto"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    sinonimos = Column(String(500), nullable=True) # Lista de sinónimos separados por comas

class RegistroMaestro(Base):
    __tablename__ = "registro_maestro"
    
    idd = Column(Integer, primary_key=True, index=True, autoincrement=False)
    sondaje = Column(String(100), nullable=True)
    codigo_muestra = Column(String(150), nullable=True)
    laboratorio = Column(String(100), nullable=True)
    dia = Column(Integer, nullable=True) # Nueva columna
    mes = Column(String(50), nullable=True)
    anio = Column(Integer, nullable=True)
    proyecto = Column(String(100), nullable=True)
    desde = Column(Float, nullable=True)
    hasta = Column(Float, nullable=True)
    longitud_muestra = Column(Float, nullable=True)
    este = Column(Float, nullable=True)
    norte = Column(Float, nullable=True)
    elevacion = Column(Float, nullable=True)
    sectores = Column(String(100), nullable=True)
    lito1 = Column(String(100), nullable=True)
    lito2 = Column(String(100), nullable=True)
    lito3 = Column(String(100), nullable=True)
    tipo_ensayo = Column(String(100), nullable=True)
    
    # Compresión Uniaxial (UCS)
    ucs_diametro = Column(Float, nullable=True)
    ucs_carga_rotura = Column(Float, nullable=True)
    ucs_resistencia = Column(Float, nullable=True)
    ucs_resistencia_calculada = Column(Float, nullable=True)
    ucs_rotura = Column(String(100), nullable=True)
    
    # Constantes Elásticas
    elasticas_modulo_young = Column(Float, nullable=True)
    elasticas_poisson = Column(Float, nullable=True)
    
    # Tracción Indirecta
    traccion_carga_promedio = Column(Float, nullable=True)
    traccion_resistencia_kgcm2 = Column(Float, nullable=True)
    traccion_vacia_28 = Column(String(100), nullable=True)
    traccion_resistencia_mpa = Column(Float, nullable=True)
    
    # Corte Directo
    corte_tipo_fractura = Column(String(100), nullable=True)
    corte_area = Column(Float, nullable=True)
    corte_esf_normal_kpa = Column(Float, nullable=True)
    corte_esf_corte_kpa = Column(Float, nullable=True)
    corte_esf_normal_mpa = Column(Float, nullable=True)
    corte_esf_corte_mpa = Column(Float, nullable=True)
    corte_cohesion_mpa = Column(Float, nullable=True)
    corte_angulo_friccion = Column(Float, nullable=True)
    
    # Compresión Triaxial
    triaxial_carga_confinamiento = Column(Float, nullable=True)
    triaxial_esfuerzo_maximo = Column(Float, nullable=True)
    triaxial_resistencia_mpa = Column(Float, nullable=True)
    triaxial_mi = Column(Float, nullable=True)
    triaxial_cohesion_mpa = Column(Float, nullable=True)
    triaxial_angulo_friccion = Column(Float, nullable=True)
    triaxial_rotura = Column(String(100), nullable=True)
    
    # Propiedades Físicas
    prop_peso_unitario_geometrico = Column(Float, nullable=True)
    
    # Comentarios y metadatos finales
    observacion = Column(String(500), nullable=True)
    campana = Column(String(100), nullable=True)