import { useState } from 'react';
import { completeSetup } from '../lib/api';
import './Onboarding.css';

interface ProductRow { name: string; price: string; stock: string }
interface CustomerRow { name: string; phone: string }

const blankProduct = (): ProductRow => ({ name: '', price: '', stock: '' });
const blankCustomer = (): CustomerRow => ({ name: '', phone: '' });

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([blankProduct(), blankProduct(), blankProduct()]);
  const [customers, setCustomers] = useState<CustomerRow[]>([blankCustomer(), blankCustomer()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filledProducts = products.filter((p) => p.name.trim() && parseFloat(p.price) > 0);
  const filledCustomers = customers.filter((c) => c.name.trim());

  const setProduct = (i: number, k: keyof ProductRow, v: string) =>
    setProducts((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const setCustomer = (i: number, k: keyof CustomerRow, v: string) =>
    setCustomers((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const finish = async () => {
    setError(''); setSaving(true);
    try {
      await completeSetup({
        shopName: shopName.trim(),
        products: filledProducts.map((p) => ({ name: p.name.trim(), price: parseFloat(p.price), stock: parseInt(p.stock) || 0 })),
        customers: filledCustomers.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() || undefined })),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const steps = ['Welcome', 'What you sell', 'Customers', 'Done'];

  return (
    <div className="onb">
      <div className="onb__card">
        <div className="onb__brand">INT<span className="onb__dot">.</span></div>
        <div className="onb__dots">
          {steps.map((_, i) => <span key={i} className={`onb__dot-step${i === step ? ' onb__dot-step--on' : ''}${i < step ? ' onb__dot-step--done' : ''}`} />)}
        </div>

        {step === 0 && (
          <div className="onb__body">
            <h1 className="onb__title">Welcome 👋</h1>
            <p className="onb__lead">I'm INT, your business partner. Let's set up your shop — it only takes a minute.</p>
            <label className="onb__label" htmlFor="shop">What's your shop's name?</label>
            <input id="shop" className="onb__input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Ama's Provisions" autoFocus />
            <div className="onb__actions">
              <button className="onb__next" disabled={!shopName.trim()} onClick={() => setStep(1)}>Continue</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb__body">
            <h1 className="onb__title">What do you sell?</h1>
            <p className="onb__lead">Add a few items to start. You can always add more later.</p>
            <div className="onb__rows">
              <div className="onb__row-head"><span>Item</span><span>Price (GH₵)</span><span>In stock</span></div>
              {products.map((p, i) => (
                <div key={i} className="onb__row onb__row--3">
                  <input className="onb__input onb__input--sm" value={p.name} onChange={(e) => setProduct(i, 'name', e.target.value)} placeholder="Item, e.g. Rice (25kg)" />
                  <input className="onb__input onb__input--sm" type="number" inputMode="decimal" value={p.price} onChange={(e) => setProduct(i, 'price', e.target.value)} placeholder="Price (GH₵)" />
                  <input className="onb__input onb__input--sm" type="number" inputMode="numeric" value={p.stock} onChange={(e) => setProduct(i, 'stock', e.target.value)} placeholder="In stock" />
                </div>
              ))}
            </div>
            <button className="onb__add" onClick={() => setProducts((r) => [...r, blankProduct()])}>＋ Add another</button>
            <div className="onb__actions">
              <button className="onb__back" onClick={() => setStep(0)}>Back</button>
              <button className="onb__next" onClick={() => setStep(2)}>{filledProducts.length ? 'Continue' : 'Skip for now'}</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb__body">
            <h1 className="onb__title">Customers who buy on credit</h1>
            <p className="onb__lead">Add people you sell to on credit, so INT can track who owes you. Optional.</p>
            <div className="onb__rows">
              <div className="onb__row-head"><span>Name</span><span>Phone (optional)</span></div>
              {customers.map((c, i) => (
                <div key={i} className="onb__row onb__row--2">
                  <input className="onb__input onb__input--sm" value={c.name} onChange={(e) => setCustomer(i, 'name', e.target.value)} placeholder="Name, e.g. Kofi Mensah" />
                  <input className="onb__input onb__input--sm" type="tel" inputMode="tel" value={c.phone} onChange={(e) => setCustomer(i, 'phone', e.target.value)} placeholder="Phone (optional)" />
                </div>
              ))}
            </div>
            <button className="onb__add" onClick={() => setCustomers((r) => [...r, blankCustomer()])}>＋ Add another</button>
            <div className="onb__actions">
              <button className="onb__back" onClick={() => setStep(1)}>Back</button>
              <button className="onb__next" onClick={() => setStep(3)}>{filledCustomers.length ? 'Continue' : 'Skip for now'}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onb__body">
            <h1 className="onb__title">You're all set{shopName.trim() ? `, ${shopName.trim()}` : ''}! 🎉</h1>
            <p className="onb__lead">
              {filledProducts.length > 0 && <>Added <b>{filledProducts.length}</b> product{filledProducts.length === 1 ? '' : 's'}. </>}
              {filledCustomers.length > 0 && <>Added <b>{filledCustomers.length}</b> customer{filledCustomers.length === 1 ? '' : 's'}. </>}
              INT will now brief you every day and answer any question about your business.
            </p>
            {error && <div className="onb__error">{error}</div>}
            <div className="onb__actions">
              <button className="onb__back" onClick={() => setStep(2)}>Back</button>
              <button className="onb__next" disabled={saving} onClick={finish}>{saving ? 'Setting up…' : 'Go to my dashboard'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
