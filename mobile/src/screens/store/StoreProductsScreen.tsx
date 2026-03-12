import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  isOutOfStock: boolean;
  productCategoryId?: string | null;
  imageUrl?: string | null;
}

export function StoreProductsScreen() {
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '999',
    productCategoryId: '',
    imageUrl: '',
    isAvailable: true,
  });
  const [editProduct, setEditProduct] = useState({
    name: '',
    price: '',
    stock: '',
    productCategoryId: '',
    imageUrl: '',
    isAvailable: true,
  });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get<Category[]>('/store-owner/categories').then((r) => r.data ?? []),
      api.get<Product[]>('/store-owner/products').then((r) => r.data ?? []),
    ])
      .then(([cats, prods]) => {
        setCategories(cats);
        setProducts(prods);
      })
      .catch(() => {
        setCategories([]);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/store-owner/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowAddCategory(false);
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to add category';
      Alert.alert('Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) return;
    setSubmitting(true);
    try {
      await api.post('/store-owner/products', {
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        stock: Number(newProduct.stock) || 999,
        productCategoryId: newProduct.productCategoryId || undefined,
        imageUrl: newProduct.imageUrl.trim() || undefined,
        isAvailable: newProduct.isAvailable,
      });
      setNewProduct({
        name: '',
        price: '',
        stock: '999',
        productCategoryId: '',
        imageUrl: '',
        isAvailable: true,
      });
      setShowAddProduct(false);
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to add product';
      Alert.alert('Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOutOfStock = async (productId: string, current: boolean) => {
    try {
      await api.patch(`/store-owner/products/${productId}/out-of-stock`, {
        isOutOfStock: !current,
      });
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update stock';
      Alert.alert('Error', String(msg));
    }
  };

  const startEdit = (p: Product) => {
    setEditingProductId(p.id);
    setEditProduct({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      productCategoryId: p.productCategoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      isAvailable: p.isAvailable ?? true,
    });
  };

  const saveProduct = async () => {
    if (!editingProductId) return;
    setSubmitting(true);
    try {
      await api.patch(`/store-owner/products/${editingProductId}`, {
        name: editProduct.name.trim(),
        price: Number(editProduct.price),
        stock: Number(editProduct.stock),
        productCategoryId: editProduct.productCategoryId || undefined,
        imageUrl: editProduct.imageUrl.trim() || undefined,
        isAvailable: editProduct.isAvailable,
      });
      setEditingProductId(null);
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to save product';
      Alert.alert('Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const uncategorized = products.filter((p) => !p.productCategoryId);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Products</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.pillButton, { backgroundColor: '#e2e8f0' }]}
                onPress={() => setShowAddCategory((v) => !v)}
              >
                <Text style={styles.pillButtonText}>Add Category</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillButton, { backgroundColor: '#0f172a' }]}
                onPress={() => setShowAddProduct((v) => !v)}
              >
                <Text style={[styles.pillButtonText, { color: '#facc15' }]}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {showAddCategory && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Category name</Text>
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="e.g. Burgers"
                  style={styles.input}
                />
                <View style={styles.inlineRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={addCategory}
                    disabled={submitting || !newCategoryName.trim()}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1, marginLeft: 8 }]}
                    onPress={() => setShowAddCategory(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {editingProductId && (
              <View style={[styles.card, { borderColor: '#0f172a', borderWidth: 1 }]}>
                <Text style={styles.sectionTitle}>Edit product</Text>
                <TextInput
                  value={editProduct.name}
                  onChangeText={(t) => setEditProduct((f) => ({ ...f, name: t }))}
                  placeholder="Name"
                  style={styles.input}
                />
                <TextInput
                  value={editProduct.imageUrl}
                  onChangeText={(t) => setEditProduct((f) => ({ ...f, imageUrl: t }))}
                  placeholder="Image URL (optional)"
                  style={styles.input}
                />
                <TextInput
                  value={editProduct.price}
                  onChangeText={(t) => setEditProduct((f) => ({ ...f, price: t }))}
                  placeholder="Price"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  value={editProduct.stock}
                  onChangeText={(t) => setEditProduct((f) => ({ ...f, stock: t }))}
                  placeholder="Stock"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() =>
                    setEditProduct((f) => ({
                      ...f,
                      isAvailable: !f.isAvailable,
                    }))
                  }
                  style={styles.switchRow}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      { backgroundColor: editProduct.isAvailable ? '#22c55e' : '#e2e8f0' },
                    ]}
                  />
                  <Text style={styles.switchLabel}>
                    {editProduct.isAvailable ? 'Visible to customers' : 'Hidden from customers'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.picker}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        !editProduct.productCategoryId && styles.chipActive,
                      ]}
                      onPress={() => setEditProduct((f) => ({ ...f, productCategoryId: '' }))}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          !editProduct.productCategoryId && styles.chipTextActive,
                        ]}
                      >
                        No category
                      </Text>
                    </TouchableOpacity>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.chip,
                          editProduct.productCategoryId === c.id && styles.chipActive,
                        ]}
                        onPress={() =>
                          setEditProduct((f) => ({ ...f, productCategoryId: c.id }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            editProduct.productCategoryId === c.id && styles.chipTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.inlineRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={saveProduct}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1, marginLeft: 8 }]}
                    onPress={() => setEditingProductId(null)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showAddProduct && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add product</Text>
                <TextInput
                  value={newProduct.name}
                  onChangeText={(t) => setNewProduct((f) => ({ ...f, name: t }))}
                  placeholder="Product name"
                  style={styles.input}
                />
                <TextInput
                  value={newProduct.imageUrl}
                  onChangeText={(t) => setNewProduct((f) => ({ ...f, imageUrl: t }))}
                  placeholder="Image URL (optional)"
                  style={styles.input}
                />
                <TextInput
                  value={newProduct.price}
                  onChangeText={(t) => setNewProduct((f) => ({ ...f, price: t }))}
                  placeholder="Price (PKR)"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  value={newProduct.stock}
                  onChangeText={(t) => setNewProduct((f) => ({ ...f, stock: t }))}
                  placeholder="Stock"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() =>
                    setNewProduct((f) => ({
                      ...f,
                      isAvailable: !f.isAvailable,
                    }))
                  }
                  style={styles.switchRow}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      { backgroundColor: newProduct.isAvailable ? '#22c55e' : '#e2e8f0' },
                    ]}
                  />
                  <Text style={styles.switchLabel}>
                    {newProduct.isAvailable ? 'Visible to customers' : 'Hidden from customers'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.picker}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        !newProduct.productCategoryId && styles.chipActive,
                      ]}
                      onPress={() =>
                        setNewProduct((f) => ({ ...f, productCategoryId: '' }))
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          !newProduct.productCategoryId && styles.chipTextActive,
                        ]}
                      >
                        No category
                      </Text>
                    </TouchableOpacity>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.chip,
                          newProduct.productCategoryId === c.id && styles.chipActive,
                        ]}
                        onPress={() =>
                          setNewProduct((f) => ({ ...f, productCategoryId: c.id }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            newProduct.productCategoryId === c.id && styles.chipTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.inlineRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={addProduct}
                    disabled={
                      submitting || !newProduct.name.trim() || !newProduct.price.trim()
                    }
                  >
                    {submitting ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1, marginLeft: 8 }]}
                    onPress={() => setShowAddProduct(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {categories.map((cat) => {
              const prods = products.filter((p) => p.productCategoryId === cat.id);
              if (prods.length === 0) return null;
              return (
                <View key={cat.id} style={{ gap: 8 }}>
                  <Text style={styles.categoryTitle}>{cat.name}</Text>
                  {prods.map((p) => (
                    <View key={p.id} style={styles.productCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productName}>{p.name}</Text>
                        <Text style={styles.productMeta}>
                          Rs {p.price} · Stock: {Number(p.stock)}{' '}
                          {p.isOutOfStock ? '(Out)' : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => toggleOutOfStock(p.id, p.isOutOfStock)}
                          style={[
                            styles.outPill,
                            p.isOutOfStock && { backgroundColor: '#f97316' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.outPillText,
                              p.isOutOfStock && { color: '#0f172a' },
                            ]}
                          >
                            {p.isOutOfStock ? 'In stock' : 'Out'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => startEdit(p)}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}

            {uncategorized.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.categoryTitle}>Uncategorized</Text>
                {uncategorized.map((p) => (
                  <View key={p.id} style={styles.productCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.productMeta}>
                        Rs {p.price} · Stock: {Number(p.stock)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => toggleOutOfStock(p.id, p.isOutOfStock)}
                        style={[
                          styles.outPill,
                          p.isOutOfStock && { backgroundColor: '#f97316' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.outPillText,
                            p.isOutOfStock && { color: '#0f172a' },
                          ]}
                        >
                          {p.isOutOfStock ? 'In stock' : 'Out'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => startEdit(p)}>
                        <Text style={styles.editLink}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  back: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pillButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#facc15',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  picker: {
    marginTop: 4,
    gap: 4,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 12,
    color: '#64748b',
  },
  chipTextActive: {
    color: '#facc15',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  switchThumb: {
    width: 40,
    height: 22,
    borderRadius: 999,
  },
  switchLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  productCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  productMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  outPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  outPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  editLink: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0ea5e9',
  },
});

