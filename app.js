// Variables de Estado
let rates = {
    bcv_usd: 0,
    bcv_eur: 0,
    binance_buy: 0,
    binance_sell: 0,
    date: null
};

// Selectores del DOM
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const refreshBtn = document.getElementById('refresh-btn');
const rateSelector = document.getElementById('rate-selector');
const inputDivisa = document.getElementById('input-divisa');
const inputVes = document.getElementById('input-ves');
const igtfSwitch = document.getElementById('igtf-switch');
const toast = document.getElementById('toast');

// Haptic Feedback (Vibración nativa si está disponible)
const haptic = () => {
    if (navigator.vibrate) navigator.vibrate(15);
};

// Formateo de Moneda
const formatCurrency = (val) => Number(val).toFixed(2);

// Actualizar Dashboard Visual
const updateDashboard = () => {
    document.getElementById('bcv-usd-val').innerText = rates.bcv_usd.toFixed(2);
    document.getElementById('bcv-eur-val').innerText = rates.bcv_eur.toFixed(2);
    document.getElementById('binance-buy-val').innerText = rates.binance_buy.toFixed(2);
    document.getElementById('binance-sell-val').innerText = rates.binance_sell.toFixed(2);

    // Calcular Brecha (Binance Compra vs BCV USD)
    if (rates.bcv_usd > 0 && rates.binance_buy > 0) {
        const gap = ((rates.binance_buy - rates.bcv_usd) / rates.bcv_usd) * 100;
        const diff100 = (rates.binance_buy * 100) - (rates.bcv_usd * 100);
        document.getElementById('gap-percent').innerText = `${gap.toFixed(2)}%`;
        document.getElementById('gap-bs').innerText = `Bs. ${diff100.toFixed(2)} / $100`;
    }
};

// Lógica de Tasa Anticipada (Banner)
const checkFutureRate = (bcvDateStr) => {
    const banner = document.getElementById('future-rate-banner');
    if (!bcvDateStr) return;

    const today = new Date();
    const localDate = today.toISOString().split('T')[0];

    if (bcvDateStr > localDate) {
        banner.classList.remove('hidden');
        document.getElementById('future-rate-text').innerText = `BCV USD: Bs. ${rates.bcv_usd.toFixed(2)}`;
    } else {
        banner.classList.add('hidden');
    }
};

// Lógica Bidireccional de Calculadora
const calculate = (source) => {
    const selectedRate = rates[rateSelector.value];
    if (!selectedRate) return;

    const useIgtf = igtfSwitch.checked;
    const igtfMultiplier = useIgtf ? 1.03 : 1;

    if (source === 'divisa') {
        const divVal = parseFloat(inputDivisa.value) || 0;
        inputVes.value = divVal === 0 ? '' : formatCurrency(divVal * selectedRate * igtfMultiplier);
    } else if (source === 'ves') {
        const vesVal = parseFloat(inputVes.value) || 0;
        inputDivisa.value = vesVal === 0 ? '' : formatCurrency(vesVal / (selectedRate * igtfMultiplier));
    }
};

// Eventos de Inputs y Teclado
inputDivisa.addEventListener('input', () => calculate('divisa'));
inputVes.addEventListener('input', () => calculate('ves'));
rateSelector.addEventListener('change', () => { haptic(); calculate('divisa'); });
igtfSwitch.addEventListener('change', () => { haptic(); calculate('divisa'); });

document.getElementById('swap-btn').addEventListener('click', () => {
    haptic();
    const t = inputDivisa.value;
    inputDivisa.value = inputVes.value;
    inputVes.value = t;
    calculate('divisa'); 
});

// Quick Chips
document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
        haptic();
        inputDivisa.value = e.target.getAttribute('data-val');
        calculate('divisa');
    });
});

// Portapapeles (Copiado Rápido WhatsApp)
document.querySelectorAll('.clickable').forEach(card => {
    card.addEventListener('click', (e) => {
        haptic();
        const type = card.getAttribute('data-copy');
        let text = "";
        
        if (type === 'bcv') {
            text = `💰 *Tasa BCV Oficial*\n💵 USD: Bs. ${rates.bcv_usd.toFixed(2)}\n💶 EUR: Bs. ${rates.bcv_eur.toFixed(2)}\n📅 Fecha: ${rates.date || 'Actual'}`;
        } else if (type === 'binance') {
            text = `🟡 *Tasa Binance P2P (USDT)*\n🔼 Compra: Bs. ${rates.binance_buy.toFixed(2)}\n🔽 Venta: Bs. ${rates.binance_sell.toFixed(2)}`;
        }

        navigator.clipboard.writeText(text).then(() => {
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 2500);
        });
    });
});

// Consumo de API usando Proxy CORS
const fetchRates = async () => {
    refreshBtn.classList.add('spin');
    
    try {
        const urlBCV = encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv');
        const urlBinance = encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=binance');

        const resBCV = await fetch(`https://corsproxy.io/?${urlBCV}`);
        const dataBCV = await resBCV.json();
        
        const resBinance = await fetch(`https://corsproxy.io/?${urlBinance}`);
        const dataBinance = await resBinance.json();

        rates = {
            bcv_usd: dataBCV.monedas.usd.price || 0,
            bcv_eur: dataBCV.monedas.eur.price || 0,
            binance_buy: dataBinance.monedas.buy.price || 0, 
            binance_sell: dataBinance.monedas.sell.price || 0,
            date: dataBCV.monedas.usd.last_update || new Date().toISOString()
        };

        // Cacheo Offline
        localStorage.setItem('tasasVzlaCache', JSON.stringify(rates));
        
        // Actualizar UI
        statusDot.className = 'dot green';
        statusText.innerText = "Actualizado";
        checkFutureRate(dataBCV.monedas.usd.fecha_valor || null);
        updateDashboard();
        calculate('divisa');
        haptic();

    } catch (error) {
        console.warn('Fallo de red o CORS, cargando caché local:', error);
        
        const cached = localStorage.getItem('tasasVzlaCache');
        if (cached) {
            rates = JSON.parse(cached);
            updateDashboard();
            calculate('divisa');
        }
        
        statusDot.className = 'dot red';
        statusText.innerText = "Modo Sin Conexión";
    } finally {
        setTimeout(() => refreshBtn.classList.remove('spin'), 500);
    }
};

// Evento de refresco manual
refreshBtn.addEventListener('click', () => {
    haptic();
    fetchRates();
});

// Inicialización de la App
window.addEventListener('DOMContentLoaded', () => {
    // 1. Intentar cargar caché local para que la UI no inicie en blanco
    const cached = localStorage.getItem('tasasVzlaCache');
    if (cached) {
        rates = JSON.parse(cached);
        updateDashboard();
    }
    // 2. Ejecutar la descarga en segundo plano
    fetchRates();
});
