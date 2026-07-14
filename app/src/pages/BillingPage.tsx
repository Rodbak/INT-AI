import { useState, useEffect } from 'react';
import { fetchPlans, fetchInvoices } from '../lib/api';
import type { BillingPlan, Invoice } from '../types/index';
import './BillingPage.css';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchInvoices()])
      .then(([plansData, invoicesData]) => {
        setPlans(plansData);
        setInvoices(invoicesData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="billing">
        <div className="billing__empty">Loading...</div>
      </div>
    );
  }

  return (
    <div className="billing">
      <div className="billing__header">
        <h1 className="billing__title">Billing</h1>
        <p className="billing__subtitle">Manage your subscription and view invoices</p>
      </div>

      <div className="billing__section">
        <h2 className="billing__section-title">Plans</h2>
        <div className="billing__plans">
          {plans.map((plan) => (
            <div key={plan.id} className="billing__plan">
              <div className="billing__plan-name">{plan.name}</div>
              <div className="billing__plan-price">
                {plan.price === 0 ? 'Free' : `$${plan.price}/${plan.interval}`}
              </div>
              <div className="billing__plan-desc">{plan.description}</div>
              <ul className="billing__plan-features">
                {plan.features.map((feature: string, index: number) => (
                  <li key={index} className="billing__plan-feature">
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.price === 0 ? (
                <span className="billing__badge">Current Plan</span>
              ) : (
                <button type="button" className="billing__upgrade">
                  Upgrade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="billing__section">
          <h2 className="billing__section-title">Invoices</h2>
          <div className="billing__invoices">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="billing__invoice-row">
                <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                <span>{invoice.plan.name}</span>
                <span>${invoice.amount.toFixed(2)}</span>
                <span className={`billing__invoice-status billing__invoice-status--${invoice.status}`}>
                  {invoice.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
